'use strict'

const { Pool } = require('pg')

let pool

function init () {
  if (!pool || pool.ending) {
    const dbUser = process.env.CPX_DB_USERNAME
    const dbHost = process.env.CPX_DB_HOST
    const dbName = process.env.CPX_DB_NAME
    const dbPassword = process.env.CPX_DB_PASSWORD
    const connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:5432/${dbName}`
    pool = new Pool({
      connectionString
    })
  }
}

module.exports = {
  init: () => {
    init()
  },
  query: (query, vars) => {
    init()
    return pool.query(query, vars)
  }
}
