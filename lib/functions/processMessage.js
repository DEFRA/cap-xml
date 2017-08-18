'use strict'

const xml2js = require('xml2js')
const AWSConfig = require('../../config/config.json').aws
const database = require('../helpers/database')
const sql = require('sql')
sql.setDialect('postgres')

module.exports.processMessage = (event, context, callback) => {
  const response = {
    statusCode: 200
  }

  xml2js.parseString(event.bodyXml, (err, result) => {
    if (err) {
      return callback(err)
    }

    const xmlBuilder = new xml2js.Builder()

    const messages = sql.define({
      name: 'messages',
      columns: ['identifier', 'alert', 'fwis_code', 'expires', 'sent', 'created']
    })

    let message = {}

    // Set the object keys
    message.identifier = result.alert.identifier[0]
    message.fwisCode = result.alert.info[0].area[0].geocode[0].value[0]
    message.sent = result.alert.sent[0]
    message.expires = result.alert.info[0].expires[0]
    message.created = new Date().toISOString()
    message.xml = xmlBuilder.buildObject(result)

    // Are we on anything but production
    if (AWSConfig.stage !== 'ea') {
      result.alert.status[0] = 'Test'
    }

    const query = messages
    .insert({
      identifier: message.identifier,
      alert: message.xml,
      fwis_code: message.fwisCode,
      expires: message.expires,
      sent: message.sent,
      created: message.created
    }).toQuery()

    console.log(query)

    console.log('Processing CAP message: ' + message.identifier + ' for ' + message.fwisCode)

    database.query(query, (err, res) => {
      if (err) {
        return callback(err)
      }
      console.log('Finished processing CAP message: ' + message.identifier + ' for ' + message.fwisCode)
      response.body = {
        message: 'Cap message successfully stored for ' + message.fwisCode,
        identifier: message.identifier,
        fwisCode: message.fwisCode,
        sent: message.sent,
        expires: message.expires,
        status: result.alert.status[0]
      }
      callback(null, response)
    })
  })
}
