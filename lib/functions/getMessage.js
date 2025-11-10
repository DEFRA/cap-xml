'use strict'

const service = require('../helpers/service')
const eventSchema = require('../schemas/getMessageEventSchema')
const { validateXML } = require('xmllint-wasm')
const fs = require('fs')
const path = require('path')
const xsdSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'CAP-v1.2.xsd'), 'utf8')

module.exports.getMessage = async (event) => {
  const { error } = eventSchema.validate(event)

  if (error) {
    throw error
  }

  const ret = await service.getMessage(event.pathParameters.id)

  if (!ret || !ret.rows || !Array.isArray(ret.rows) || ret.rows.length < 1 || !ret.rows[0].getmessage) {
    console.log('No message found for ' + event.pathParameters.id)
    throw new Error('No message found')
  }

  const validationResult = await validateXML({
    xml: [{
      fileName: 'message.xml',
      contents: ret.rows[0].getmessage.alert
    }],
    schema: [xsdSchema]
  })

  // NI-95 log validation errors and continue processing
  if (validationResult.errors?.length > 0) {
    console.log('CAP get message failed validation')
    console.log(JSON.stringify(validationResult.errors))
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    },
    body: ret.rows[0].getmessage.alert
  }
}
