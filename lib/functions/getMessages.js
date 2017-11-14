'use strict'

const database = require('../helpers/database')
const queries = require('../helpers/queries')

module.exports.getMessages = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false

  // no validation as no inputs

  database.query(queries.getAllMessages, (err, ret) => {
    if (err) {
      return callback(err)
    }

    // Add xml document declaration and group the messages with <messages>
    let xmlAlerts = '<?xml version="1.0" standalone="yes"?>\n<messages>\n'
    ret.rows.forEach((item) => {
      xmlAlerts += item.alert + '\n'
    })
    xmlAlerts += '</messages>'

    response.body = xmlAlerts
    return callback(null, response)
  })
}
