'use strict'

const AWSConfig = require('../../config/config.json').aws
const { Pool } = require('pg')

let pool

function init () {
  if (!pool || pool.ending) {
    pool = new Pool({
      connectionString: AWSConfig.rdsConnectionString
    })
  }
}

module.exports = {
  init: () => {
    if (!pool || pool.ending) {
      pool = new Pool({
        connectionString: AWSConfig.rdsConnectionString
      })
    }
  },
  query: (query, vars) => {
    init()
    return pool.query(query, vars)
  }
}
