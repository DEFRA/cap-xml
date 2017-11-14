'use strict'

const xml2js = require('xml2js')
const sql = require('sql').setDialect('postgres')
const messages = sql.define({
  name: 'messages',
  columns: ['identifier', 'msg_type', 'references', 'alert', 'fwis_code', 'expires', 'sent', 'created']
})
const xmlBuilder = new xml2js.Builder({
  headless: true,
  cdata: true
})

function Message (xmlMessage) {
  let message = {
    identifier: xmlMessage.alert.identifier[0],
    msg_type: xmlMessage.alert.msgType[0],
    references: xmlMessage.alert.references ? xmlMessage.alert.references[0] : '',
    alert: xmlBuilder.buildObject(xmlMessage).replace(/&#xD;/g, ''),
    fwis_code: xmlMessage.alert.info[0].area[0].geocode[0].value[0],
    expires: xmlMessage.alert.info[0].expires[0],
    sent: xmlMessage.alert.sent[0],
    created: new Date().toISOString()
  }

  Object.defineProperties(this, {
    data: {
      value: message
    },
    putQuery: {
      value: messages.insert(message).toQuery()
    }
  })
}

module.exports = Message
