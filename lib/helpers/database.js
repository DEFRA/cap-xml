'use strict'

const AWSConfig = require('../../config/config.json').aws
const { Pool } = require('pg')

let pool

module.exports = {
  init: () => {
    if (!pool || pool.ending) {
      pool = new Pool({
        connectionString: AWSConfig.rdsConnectionString
      })
    }
  },
  query: (query, callback) => {
    pool.query(query, function (err, ret) {
      if (err) {
        callback(err)
      } else {
        callback(null, ret)
      }
    })
  },
  queryVars: (query, vars, callback) => {
    pool.query(query, vars, function (err, ret) {
      if (err) {
        callback(err)
      } else {
        callback(null, ret)
      }
    })
  }
}
