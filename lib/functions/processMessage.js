'use strict'

const parseXml = require('xml2js').parseString
// const AWSConfig = require('../../config/config.json').aws
// const database = require('../helpers/database')

const Client = require('pg')
const client = new Client()
const sql = require('sql')
sql.setDialect('postgres')

client.connect()

module.exports.processMessage = (event, context, callback) => {
  var messages = sql.define({
    name: 'messages',
    columns: ['id', 'alert', 'fwisCode', 'expires', 'sent', 'created']
  })

}

// module.exports.processMessage = (event, context, callback) => {
//   const response = {
//     statusCode: 200
//   }

//   parseXml(event.bodyXml, (err, result) => {
//     if (err) {
//       return callback(err)
//     }

//     // Set the dynamodb object's keys
//     result.id = result.alert.identifier[0]
//     result.fwisCode = result.alert.info[0].area[0].geocode[0].value[0]
//     result.sent = result.alert.sent[0]
//     result.expires = result.alert.info[0].expires[0]

//     // Are we on anything but production
//     if (AWSConfig.stage !== 'ea') {
//       result.alert.status[0] = 'Test'
//     }

//     console.log('Processing CAP message: ' + result.id + ' for ' + result.fwisCode)

//     let params = {
//       TableName: AWSConfig.stage + 'cx_fwa',
//       Item: result,
//       ReturnConsumedCapacity: 'TOTAL'
//     }

//     database.put(params, (err, data) => {
//       if (err) {
//         return callback(err)
//       }
//       response.body = data
//       callback(null, response)
//     })
//   })
// }
