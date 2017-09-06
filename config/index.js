'use strict'

const Joi = require('joi')

const schema = require('./schema')
const config = require('./config.json')

Joi.validate(config, schema, (err, value) => {
  if (err) {
    throw err
  }
  console.log('Config.json validated')
  return true
})
