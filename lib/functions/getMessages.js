'use strict'

const database = require('../helpers/database')

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
  // TODO package queries into config and create indexes on database
  let query = 'select * from cx.messages m inner join (select distinct on (fwis_code) id from cx.messages order by fwis_code, sent desc) as l on l.id = m.id where m.expires > now()::timestamp order by m.created desc'

  database.query(query, (err, ret) => {
    if (err) {
      callback(err)
    }

    let xmlAlerts = '<?xml version="1.0" standalone="yes"?>\n' +
                    '<messages>\n'
    ret.rows.forEach((item) => {
      xmlAlerts += item.alert + '\n'
    })

    xmlAlerts += '</messages>'

    response.body = xmlAlerts
    callback(null, response)
  })
}
