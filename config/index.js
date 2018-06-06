'use strict'

const Joi = require('joi')

const schema = require('./schema')
const config = require('./config.json')

const { error } = Joi.validate(config, schema)
if (error) throw error
console.log('Config.json validated')
