'use strict'

module.exports.processMessage = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({})
  }

  console.log('processMessage')

  callback(null, response)
}
