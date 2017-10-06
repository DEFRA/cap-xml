'use strict'

const database = require('../helpers/database')
const queries = require('../helpers/queries')

module.exports.getMessage = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }
  let id = event.pathParameters.id
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false

  database.queryVars(queries.getMessage, [id], (err, ret) => {
    if (err || ret.rows.length === 0) {
      return callback(err || new Error('No message found'))
    }

    response.body = ret.rows[0].alert
    callback(null, response)
  })
}
