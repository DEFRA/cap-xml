'use strict'

const service = require('../helpers/service')
const eventSchema = require('../helpers/schemas').getMessageEventSchema

module.exports.getMessage = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }

  const { error } = eventSchema.validate(event)

  if (error) {
    throw error
  }

  const ret = await service.getMessage(event.pathParameters.id)

  if (!ret || !ret.rows || !Array.isArray(ret.rows) || ret.rows.length < 1 || !ret.rows[0].getmessage) {
    console.log('No message found for ' + event.pathParameters.id)
    throw new Error('No message found')
  }

  response.body = ret.rows[0].getmessage.alert
  return response
}
