'use strict'

const database = require('../helpers/database')
const sql = require('sql')
sql.setDialect('postgres')

module.exports.getMessages = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false

  console.log('Getting all active messages')

  // Query needs updating to get the latest active alerts for each area
  let query = 'select distinct on (fwis_code) * from cx.messages order by fwis_code, sent desc'

  database.query(query, (err, ret) => {
    if (err) {
      callback(err)
    }

    let xmlAlerts = '<?xml version="1.0" standalone="yes"?>\n' +
                    '<alerts>\n'
    ret.rows.forEach((item) => {
      xmlAlerts += item.alert + '\n'
    })

    xmlAlerts += '</alerts>'

    response.body = xmlAlerts
    callback(null, response)
  })
}
