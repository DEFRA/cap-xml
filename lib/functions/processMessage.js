'use strict'

const xml2js = require('xml2js')
const AWSConfig = require('../../config/config.json').aws
const database = require('../helpers/database')
const sql = require('sql')
sql.setDialect('postgres')
const getLastMessageQuery = 'select * from cx.messages where fwis_code = $1 order by sent desc limit 1'

const messages = sql.define({
  name: 'messages',
  columns: ['identifier', 'msg_type', 'references', 'alert', 'fwis_code', 'expires', 'sent', 'created']
})

const xmlBuilder = new xml2js.Builder({
  headless: true
})

module.exports.processMessage = (event, context, callback) => {
  const response = {
    statusCode: 200
  }
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false

  xml2js.parseString(event.bodyXml, (err, xmlResult) => {
    if (err) {
      return callback(err)
    }

    // Need to get the last alert for fwiscode if active still, so we can populate references and sort out status.
    database.queryVars(getLastMessageQuery, [xmlResult.alert.info[0].area[0].geocode[0].value[0]], (err, dbResult) => {
      if (err) {
        return callback(err)
      }
      let lastMessage = dbResult.rows[0]

      // XML manipulation
      // Are we on anything but production
      if (AWSConfig.stage !== 'ea') {
        xmlResult.alert.status[0] = 'Test'
      }
      // we found an active alert so update the references and status of our new alert
      if (lastMessage && lastMessage.expires > new Date()) {
        xmlResult.alert.references = [lastMessage.references ? lastMessage.references : xmlResult.alert.sender[0] + ',' + lastMessage.identifier + ',' + lastMessage.sent.toISOString()]
        xmlResult.alert.msgType[0] = xmlResult.alert.msgType[0] === 'Alert' ? 'Update' : xmlResult.alert.msgType[0]
      } else {
        xmlResult.alert.references = ['']
        xmlResult.alert.msgType[0] = 'Alert'
      }

      let newMessage = {
        identifier: xmlResult.alert.identifier[0],
        msg_type: xmlResult.alert.msgType[0],
        references: xmlResult.alert.references[0],
        alert: xmlBuilder.buildObject(xmlResult),
        fwis_code: xmlResult.alert.info[0].area[0].geocode[0].value[0],
        expires: xmlResult.alert.info[0].expires[0],
        sent: xmlResult.alert.sent[0],
        created: new Date().toISOString()
      }

      // let message = {}

      // // Set the object keys
      // message.identifier = xmlResult.alert.identifier[0]
      // message.fwisCode = xmlResult.alert.info[0].area[0].geocode[0].value[0]
      // message.sent = xmlResult.alert.sent[0]
      // message.expires = xmlResult.alert.info[0].expires[0]
      // message.created = new Date().toISOString()
      // message.xml = xmlBuilder.buildObject(xmlResult)

      const query = messages.insert(newMessage).toQuery()
  
      console.log('Processing CAP message: ' + newMessage.identifier + ' for ' + newMessage.fwisCode)
  
      database.query(query, (err, res) => {
        if (err) {
          return callback(err)
        }
        console.log('Finished processing CAP message: ' + newMessage.identifier + ' for ' + newMessage.fwisCode)
        response.body = {
          message: 'Cap message successfully stored for ' + newMessage.fwisCode,
          identifier: newMessage.identifier,
          fwisCode: newMessage.fwisCode,
          sent: newMessage.sent,
          expires: newMessage.expires,
          status: xmlResult.alert.status[0]
        }
        callback(null, response)
      })
    })
  })
}
