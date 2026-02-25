'use strict'

const xml2js = require('xml2js')
const moment = require('moment')
const service = require('../helpers/service')
const eventSchema = require('../schemas/processMessageEventSchema')
const aws = require('../helpers/aws')
const { validateXML } = require('xmllint-wasm')
const fs = require('node:fs')
const path = require('node:path')
const xsdSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'CAP-v1.2.xsd'), 'utf8')
const additionalCapMessageSchema = require('../schemas/additionalCapMessageSchema')
const Message = require('../models/message')
const EA_WHO = '2.49.0.1.826.1'
const CODE = 'MCP:v2.0'
const severityV2Mapping = require('../models/v2MessageMapping')
const redis = require('../helpers/redis')
const meteoalarm = require('../helpers/meteoalarm')

module.exports.processMessage = async (event) => {
  try {
    // validate the event
    await eventSchema.validateAsync(event)

    // parse the xml
    const message = new Message(event.bodyXml)
    console.log(`Processing CAP message: ${message.identifier} for ${message.fwisCode}`)

    // get Last message
    const dbResult = await service.getLastMessage(message.fwisCode)
    const lastMessage = (!!dbResult && dbResult.rows.length > 0) ? dbResult.rows[0] : undefined

    // If not production set status to test
    if (process.env.stage !== 'prd') {
      message.status = 'Test'
    }

    // Add in the references field and update msgtype to Update if references exist and is Alert (does this in message model)
    const references = buildReference(lastMessage, message.sender, 'identifier', 'references')
    if (references) {
      message.references = references
    }

    // Generate message V2 for meteoalarm spec
    const messageV2 = processMessageV2(message, lastMessage)

    // do validation against OASIS CAP xml schema and extended JOI schema
    const results = await Promise.allSettled([
      validateAgainstXsdSchema(message),
      validateAgainstJoiSchema(message),
      validateAgainstXsdSchema(messageV2),
      validateAgainstJoiSchema(messageV2)
    ])

    // Check for validation failures and throw
    const errors = results.filter(r => r.status === 'rejected').flatMap(r => r.reason)
    if (errors.length > 0) {
      throw new Error(JSON.stringify(errors))
    }

    const { message: redisMessage, query: dbQuery } = message.putQuery(message, messageV2)
    // store the message in database, redis/elasticache, and post to Meteoalarm
    const promises = [
      service.putMessage(dbQuery),
      redis.set(redisMessage.identifier, redisMessage)
    ]
    if (process.env.CPX_METEOALARM_DISABLE === 'true') {
      console.log('Meteoalarm integration is disabled')
    } else {
      promises.push(meteoalarm.postWarning(messageV2.toString(), message.identifier))
    }
    await Promise.all(promises)
    console.log(`Finished processing CAP message: ${message.identifier} for ${message.fwisCode}`)

    return {
      statusCode: 200,
      body: {
        message: `Cap message successfully stored for ${message.fwisCode}`,
        identifier: message.identifier,
        fwisCode: message.fwisCode,
        sent: message.sent,
        expires: message.expires,
        status: message.status
      }
    }
  } catch (err) {
    // Actual error will be handled by lambda process
    // So just log the message body to console for investigation
    console.log(event.bodyXml)
    return processFailedMessage(err, event.bodyXml)
  }
}

const processFailedMessage = async (originalError, xmlResult) => {
  // For backwards compatibility, only send a notification if an AWS SNS topic
  // is configured.
  if (process.env.CPX_SNS_TOPIC) {
    try {
      const messageLog = {
        receivedMessage: JSON.stringify(xmlResult),
        errorMessage: originalError.message,
        dateCreated: new Date().toISOString()
      }

      // Send a notification of failed message processing.
      await aws.email.publishMessage(messageLog)

      throw originalError
    } catch (err) {
      err.message = `[500] ${err.message}`
      throw err
    }
  } else {
    // Propagate the error to preserve legacy behaviour.
    throw originalError
  }
}

const buildReference = (lastMessage, sender, idField, refField) => {
  if (lastMessage && lastMessage.expires > new Date()) {
    const newReference = `${sender},${lastMessage[idField]},${moment(lastMessage.sent).utc().format('YYYY-MM-DDTHH:mm:ssZ')}`
    return lastMessage[refField] ? `${lastMessage[refField]} ${newReference}` : newReference
  }
  return ''
}

const validateAgainstXsdSchema = async (message) => {
  const validationResult = await validateXML({
    xml: [{
      fileName: 'message.xml',
      contents: message.toString()
    }],
    schema: [xsdSchema]
  })

  if (validationResult.errors?.length > 0) {
    throw validationResult.errors
  }
}

const validateAgainstJoiSchema = async (message) => {
  const jsMessage = await new Promise((resolve, reject) => {
    xml2js.parseString(message.toString(), (err, value) => {
      if (err) return reject(err)
      return resolve(value)
    })
  })

  const joiValidation = additionalCapMessageSchema.validate(jsMessage, { abortEarly: false })
  if (joiValidation.error) {
    throw joiValidation.error?.details
  }
}

const formatDate = (isoString) => {
  const date = new Date(isoString)
  const pad = n => n.toString().padStart(2, '0')

  const YYYY = date.getUTCFullYear()
  const MM = pad(date.getUTCMonth() + 1)
  const DD = pad(date.getUTCDate())
  const HH = pad(date.getUTCHours())
  const mm = pad(date.getUTCMinutes())
  const SS = pad(date.getUTCSeconds())

  return `${YYYY}${MM}${DD}${HH}${mm}${SS}`
}

// Generates a new message based on the Meteoalarm specification https://eaflood.atlassian.net/browse/NI-121
const processMessageV2 = (message, lastMessage) => {
  const messageV2 = new Message(message.toString())
  messageV2.identifier = message.sent && message.identifier ? `${EA_WHO}.${formatDate(message.sent)}.${message.identifier}` : ''
  messageV2.code = CODE
  // Add in the references field and update msgtype to Update if references exist and is Alert (does this in message model)
  const referencesV2 = buildReference(lastMessage, message.sender, 'identifier_v2', 'references_v2')
  if (referencesV2) {
    messageV2.references = referencesV2
  }
  messageV2.event = `${severityV2Mapping[message.severity]?.description}: ${messageV2.areaDesc}`
  messageV2.responseType = 'Monitor'
  messageV2.severity = severityV2Mapping[message.severity]?.severity || ''
  messageV2.onset = message.sent
  messageV2.headline = `${severityV2Mapping[message.severity]?.headline}: ${messageV2.areaDesc}`

  let instruction = severityV2Mapping[message.severity]?.instruction
  if (instruction) {
    const quickdialSentence = severityV2Mapping[message.severity]?.quickdialSentence
    const quickdialNumber = messageV2.quickdialNumber
    // add fwisCode to instruction target area url
    instruction = instruction.replace('{{ fwisCode }}', messageV2.fwisCode)
    // if we have a number inject into the sentence, otherwise remove the sentence fully
    instruction = instruction.replace('{{ quickdialSentence }}', quickdialNumber ? quickdialSentence.replace('{{ quickdialNumber }}', quickdialNumber) : '')
    messageV2.instruction = instruction
  }

  messageV2.addParameter('awareness_level', severityV2Mapping[message.severity]?.awarenessLevel || '')
  messageV2.addParameter('awareness_type', '12; Flooding')
  messageV2.addParameter('impacts', severityV2Mapping[message.severity]?.impact || '')
  messageV2.addParameter('use_polygon_over_geocode', 'true')
  messageV2.addParameter('uk_ea_ta_code', message.fwisCode)

  messageV2.removeNode('geocode')

  return messageV2
}
