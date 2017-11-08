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
      return callback(err)
    }
    let id = event.pathParameters.id
    console.log('2')

    database.queryVars(queries.getMessage, [id], (err, ret) => {
      if (err) {
        console.log('3')
        return callback(err)
      }
      console.log('4')
      if (ret.rows.length === 0) {
        console.log('5')
        console.log('No message found for ' + event.pathParameters.id)
        return callback(null, response)
      }
      console.log('5')
      response.body = ret.rows[0].alert
      callback(null, response)
    })
  })
}
