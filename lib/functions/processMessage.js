'use strict'

const xml2js = require('xml2js')
const moment = require('moment')
const service = require('../helpers/service')
const Message = require('../models/message')
const eventSchema = require('../schemas/processMessageEventSchema')

module.exports.processMessage = async (event) => {
  const response = {
    statusCode: 200
  }

  const { error } = eventSchema.validate(event)

  if (error) {
    throw error
  }

  // Add in the references field
  const xmlMessage = event.bodyXml.replace('</scope>', '</scope>\n<references></references>')

  const xmlResult = await new Promise((resolve, reject) => {
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
  if (lastMessage && lastMessage.expires > new Date()) {
    xmlResult.alert.references = [lastMessage.references ? lastMessage.references + ' ' + xmlResult.alert.sender[0] + ',' + lastMessage.identifier + ',' + moment(lastMessage.sent).utc().format('YYYY-MM-DDTHH:mm:ssZ') : xmlResult.alert.sender[0] + ',' + lastMessage.identifier + ',' + moment(lastMessage.sent).utc().format('YYYY-MM-DDTHH:mm:ssZ')]
    xmlResult.alert.msgType[0] = xmlResult.alert.msgType[0] === 'Alert' ? 'Update' : xmlResult.alert.msgType[0]
  } else {
    delete xmlResult.alert.references
  }

  const message = new Message(xmlResult)

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

  return response
}
