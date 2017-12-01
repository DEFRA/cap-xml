'use strict'

const Joi = require('joi')
const database = require('../helpers/database')
const queries = require('../helpers/queries')
const eventSchema = require('../helpers/schemas').getMessageEventSchema

module.exports.getMessage = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false

  database.init()

  Joi.validate(event, eventSchema, (err, value) => {
    if (err) {
      return callback(err)
    }

    database.queryVars(queries.getMessage, [event.pathParameters.id], (err, ret) => {
      if (err) {
        return callback(err)
      }

      if (!ret || !ret.rows || ret.rows.length === 0) {
        console.log('No message found for ' + event.pathParameters.id)
        return callback(new Error('No message found'))
      }

      response.body = ret.rows[0].alert
      return callback(null, response)
    })
  })
}
