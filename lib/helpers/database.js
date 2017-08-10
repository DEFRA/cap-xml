'use strict'

const AWS = require('aws-sdk')
const AWSConfig = require('../../config/config.json').aws
AWS.config.update(AWSConfig)
const ddb = new AWS.DynamoDB.DocumentClient()

module.exports = {
  put: (params, callback) => {
    ddb.put(params, function (err, data) {
      if (err) {
        callback(err)
      } else {
        callback(null, data)
      }
    })
  }
}
