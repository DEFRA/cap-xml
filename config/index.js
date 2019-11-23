'use strict'

const schema = require('./schema')
const config = require('./config.json')

const { error } = schema.validate(config)
if (error) throw new Error(error)
console.log('Config.json validated')
