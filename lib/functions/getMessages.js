'use strict'

const AWS = require('aws-sdk')
const AWSConfig = require('../../config/config.json').aws
AWS.config.update(AWSConfig)
const ddb = new AWS.DynamoDB.DocumentClient()

module.exports.getMessages = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify('<xml><alert>mock test</alert></xml>')
  }

  console.log('Getting all active messages')

  var params = {
    TableName: AWSConfig.stage + 'cx_fwa',
    IndexName: 'fwisCode-sent-index'
    // ,
    // KeyConditionExpression: '#fc = :fc',
    // ExpressionAttributeNames: {
    //   '#fc': 'fwisCode'
    // },
    // ExpressionAttributeValues: {
    //   ':fc': '065WAF33Hogsmill'
    // }
  }

  // var params = {
  //   TableName: AWSConfig.stage + 'cx_fwa',
  //   KeyConditionExpression: '#fc = :fc',
  //   ExpressionAttributeNames: {
  //     '#fc': 'fwisCode'
  //   },
  //   ExpressionAttributeValues: {
  //     ':fc': '065WAF33Hogsmill'
  //   }
  // }

  ddb.scan(params, (err, data) => {
    if (err) {
      callback(err)
    }
    response.body = data.Items
    callback(null, response)
  })
}
