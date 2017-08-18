'use strict'

const AWSConfig = require('../../config/config.json').aws
const { Client } = require('pg')
const client = new Client({
  connectionString: AWSConfig.rdsConnectionString
})

client.connect()

module.exports = {
  query: (query, callback) => {
    client.query(query, function (err, ret) {
      if (err) {
        callback(err)
      } else {
        callback(null, ret)
      }
    })
  }
}
