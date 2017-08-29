'use strict'

const xml2js = require('xml2js')
const AWSConfig = require('../../config/config.json').aws
const database = require('../helpers/database')
const sql = require('sql')
sql.setDialect('postgres')
const getLastMessageQuery = 'select * from cx.messages where fwis_code = $1 order by created desc limit 1'

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

  // Add in the references field
  let message = event.bodyXml.replace('</scope>', '</scope>\n<references></references>')

  xml2js.parseString(message, (err, xmlResult) => {
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

      if (lastMessage && lastMessage.expires > new Date()) {
        // we found an active alert so update the references and status of our new alert
        xmlResult.alert.references = [lastMessage.references ? lastMessage.references : xmlResult.alert.sender[0] + ',' + lastMessage.identifier + ',' + lastMessage.sent.toISOString().replace('.000Z', '-00:00')]
        xmlResult.alert.msgType[0] = xmlResult.alert.msgType[0] === 'Alert' ? 'Update' : xmlResult.alert.msgType[0]
      } else {
        xmlResult.alert.msgType[0] = 'Alert'
        delete xmlResult.alert.references
      }

      let newMessage = {
        identifier: xmlResult.alert.identifier[0],
        msg_type: xmlResult.alert.msgType[0],
        references: xmlResult.alert.references ? xmlResult.alert.references[0] : '',
        alert: xmlBuilder.buildObject(xmlResult),
        fwis_code: xmlResult.alert.info[0].area[0].geocode[0].value[0],
        expires: xmlResult.alert.info[0].expires[0],
        sent: xmlResult.alert.sent[0],
        created: new Date().toISOString()
      }

      const query = messages.insert(newMessage).toQuery()

      console.log('Processing CAP message: ' + newMessage.identifier + ' for ' + newMessage.fwis_code)

      database.query(query, (err, res) => {
        if (err) {
          return callback(err)
        }
        console.log('Finished processing CAP message: ' + newMessage.identifier + ' for ' + newMessage.fwis_code)
        response.body = {
          message: 'Cap message successfully stored for ' + newMessage.fwis_code,
          identifier: newMessage.identifier,
          fwisCode: newMessage.fwis_code,
          sent: newMessage.sent,
          expires: newMessage.expires,
          status: xmlResult.alert.status[0]
        }
        callback(null, response)
      })
    })
  })
}
