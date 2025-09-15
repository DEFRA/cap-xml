'use strict'

const xml2js = require('xml2js')
const moment = require('moment')
const service = require('../helpers/service')
const Message = require('../models/message')
const eventSchema = require('../schemas/processMessageEventSchema')
const aws = require('../helpers/aws')
const { validateXML } = require('xmllint-wasm')
const fs = require('fs')
const path = require('path')
const xsdSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'CAP-v1.2.xsd'), 'utf8')

module.exports.processMessage = async (event) => {
  let xmlResult
  let returnValue

  try {
    const response = {
      statusCode: 200
    }

    const { error } = eventSchema.validate(event)

    if (error) {
      throw error
    }

    // Add in the references field
    const xmlMessage = event.bodyXml.replace('</scope>', '</scope>\n<references></references>')

    const validationResult = await validate(xmlMessage, xsdSchema)
    // NI-95 log validation errors and continue processing
    if (validationResult.errors?.length > 0) {
      console.log('CAP message failed validation: pre processing')
      console.log(JSON.stringify(validationResult.errors))
      console.log(xmlMessage)
    }

    xmlResult = await new Promise((resolve, reject) => {
      xml2js.parseString(xmlMessage, (err, value) => {
        if (err) return reject(err)
        resolve(value)
      })
    })

    const dbResult = await service.getLastMessage(xmlResult.alert.info[0].area[0].geocode[0].value[0])

    const lastMessage = (!!dbResult && dbResult.rows.length > 0) ? dbResult.rows[0] : undefined

    // If not production set status to test
    if (process.env.stage !== 'prd') {
      xmlResult.alert.status[0] = 'Test'
    }

    // If the last message is active then update references and msgtype
    updateReferences(lastMessage, xmlResult)

    const message = new Message(xmlResult)

    const validationResult2 = await validate(message.data.alert, xsdSchema)
    // NI-95 log validation errors and continue processing
    if (validationResult2.errors?.length > 0) {
      console.log('CAP message failed validation: post processing')
      console.log(JSON.stringify(validationResult2.errors))
      console.log(message.data.alert)
    }

    console.log('Processing CAP message: ' + message.data.identifier + ' for ' + message.data.fwis_code)

    await service.putMessage(message.putQuery)

    console.log('Finished processing CAP message: ' + message.data.identifier + ' for ' + message.data.fwis_code)
    response.body = {
      message: 'Cap message successfully stored for ' + message.data.fwis_code,
      identifier: message.data.identifier,
      fwisCode: message.data.fwis_code,
      sent: message.data.sent,
      expires: message.data.expires,
      status: xmlResult.alert.status[0]
    }

    returnValue = response
  } catch (err) {
    await processFailedMessage(err, event.bodyXml)
  }
  return returnValue
}

async function processFailedMessage (originalError, xmlResult) {
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

const validate = (message, schema) => {
  return validateXML({
    xml: [{
      fileName: 'message.xml',
      contents: message
    }],
    schema: [schema]
  })
}

const updateReferences = (lastMessage, xmlResult) => {
  if (lastMessage && lastMessage.expires > new Date()) {
    xmlResult.alert.references = [lastMessage.references ? lastMessage.references + ' ' + xmlResult.alert.sender[0] + ',' + lastMessage.identifier + ',' + moment(lastMessage.sent).utc().format('YYYY-MM-DDTHH:mm:ssZ') : xmlResult.alert.sender[0] + ',' + lastMessage.identifier + ',' + moment(lastMessage.sent).utc().format('YYYY-MM-DDTHH:mm:ssZ')]
    xmlResult.alert.msgType[0] = xmlResult.alert.msgType[0] === 'Alert' ? 'Update' : xmlResult.alert.msgType[0]
  } else {
    delete xmlResult.alert.references
  }
}
