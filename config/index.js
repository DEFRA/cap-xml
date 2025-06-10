'use strict'
const Joi = require('joi')

const schema = Joi.object({
  stage: Joi.string().required(),
  region: Joi.string().required(),
  dbUser: Joi.string().required(),
  dbHost: Joi.string().required(),
  dbName: Joi.string().required(),
  dbPassword: Joi.string().required(),
  gatewayUrl: Joi.string().uri().required()
})

const result = schema.validate({
  stage: process.env.stage,
  region: process.env.CPX_REGION,
  dbUser: process.env.CPX_DB_USERNAME,
  dbHost: process.env.CPX_DB_HOST,
  dbName: process.env.CPX_DB_NAME,
  dbPassword: process.env.CPX_DB_PASSWORD,
  gatewayUrl: process.env.CPX_AGW_URL
})

if (result.error) {
  throw new Error('Config validation failed: ' + JSON.stringify(result.error))
}

console.log('Config is valid')
