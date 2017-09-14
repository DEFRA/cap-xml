'use strict'

const xml2js = require('xml2js')
const moment = require('moment')
const AWSConfig = require('../../config/config.json').aws
const database = require('../helpers/database')
const Message = require('../models/message')
const queries = require('../helpers/queries')

module.exports.processMessage = (event, context, callback) => {
  const response = {
    statusCode: 200
  }
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false

  if (!event.bodyXml) {
    return callback(new Error('Incorrect data format'))
  }

  // Add in the references field
  let message = event.bodyXml.replace('</scope>', '</scope>\n<references></references>')

  xml2js.parseString(message, (err, xmlResult) => {
    if (err) {
      return callback(err)
    }
    // Need to get the last alert for fwiscode if still active, so we can populate references and sort out status.
    database.queryVars(queries.getLastMessage, [xmlResult.alert.info[0].area[0].geocode[0].value[0]], (err, dbResult) => {
      if (err) {
        return callback(err)
      }
      let lastMessage = dbResult.rows[0]

      // If not production set status to test
      if (AWSConfig.stage !== 'ea') {
        xmlResult.alert.status[0] = 'Test'
      }

      // If the last message is active then update references and msgtype
      if (lastMessage && lastMessage.expires > new Date()) {
        xmlResult.alert.references = [lastMessage.references ? lastMessage.references : xmlResult.alert.sender[0] + ',' + lastMessage.identifier + ',' + moment(lastMessage.sent).utc().format('YYYY-MM-DDTHH:MM:SSZ')]
        xmlResult.alert.msgType[0] = xmlResult.alert.msgType[0] === 'Alert' ? 'Update' : xmlResult.alert.msgType[0]
      } else {
        delete xmlResult.alert.references
      }

      let message = new Message(xmlResult)

      console.log('Processing CAP message: ' + message.data.identifier + ' for ' + message.data.fwis_code)

      database.query(message.putQuery, (err, res) => {
        if (err) {
          return callback(err)
        }
        console.log('Finished processing CAP message: ' + message.data.identifier + ' for ' + message.data.fwis_code)
        response.body = {
          message: 'Cap message successfully stored for ' + message.data.fwis_code,
          identifier: message.data.identifier,
          fwisCode: message.data.fwis_code,
          sent: message.data.sent,
          expires: message.data.expires,
          status: xmlResult.alert.status[0]
        }
        callback(null, response)
      })
    })
  })
}
