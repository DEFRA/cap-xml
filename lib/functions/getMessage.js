'use strict'

const Joi = require('joi')
const database = require('../helpers/database')
const queries = require('../helpers/queries')
const eventSchema = require('../helpers/schemas.js').getMessageEventSchema

module.exports.getMessage = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false
  console.log('1')
  Joi.validate(event, eventSchema, (err, value) => {
    if (err) {
      console.log('2')
      console.log(err)
      return callback(err)
    }
    let id = event.pathParameters.id

    database.queryVars(queries.getMessage, [id], (err, ret) => {
      if (err) {
        console.log('3')
        console.log(err)
        return callback(err)
      }

      if (ret.rows.length === 0) {
        console.log('No message found for ' + event.pathParameters.id)
        return callback(null, response)
      }
      console.log('4')
      console.log(ret.rows)
      response.body = ret.rows[0].alert
      console.log('5')
      console.log(response)
      callback(null, response)
    })
  })
}
