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

module.exports.processMessage = async (event) => {
  try {
    // validate the event
    await eventSchema.validateAsync(event)

    // parse the xml
    const message = new Message(event.bodyXml)
    console.log(`Processing CAP message: ' + ${message.identifier} for ${message.fwisCode}`)

    // get Last message
    const dbResult = await service.getLastMessage(message.fwisCode)
    const lastMessage = (!!dbResult && dbResult.rows.length > 0) ? dbResult.rows[0] : undefined

    // If not production set status to test
    if (process.env.stage !== 'prd') {
      message.status = 'Test'
    }

    // Add in the references field and update msgtype to Update if references exist and is Alert
    const references = getReferences(lastMessage, message.sender)
    if (references) {
      message.references = references
    }

    // do validation
    const results = await Promise.allSettled([
      // Validate xml against CAP XSD schema https://eaflood.atlassian.net/browse/NI-95
      validateAgainstXsdSchema(message),
      // Convert xml to js object for joi extended validation https://eaflood.atlassian.net/browse/NI-113
      validateAgainstJoiSchema(message)
    ])

    // Check for validation failures and throw
    const errors = results.filter(r => r.status === 'rejected').flatMap(r => r.reason)
    if (errors.length > 0) {
      throw new Error(JSON.stringify(errors))
    }

    // store the message in database
    await service.putMessage(message.putQuery())
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
  // For backwards compapibility, only send a notification if an AWS SNS topic
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

const getReferences = (lastMessage, sender) => {
  if (lastMessage && lastMessage.expires > new Date()) {
    const newReference = `${sender},${lastMessage.identifier},${moment(lastMessage.sent).utc().format('YYYY-MM-DDTHH:mm:ssZ')}`
    return lastMessage.references ? `${lastMessage.references} ${newReference}` : newReference
  } else {
    return ''
  }
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
    throw joiValidation.error.details ?? [joiValidation.error]
  }
}
