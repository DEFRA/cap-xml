'use strict'

const Joi = require('joi')

const getMessageEventSchema = Joi.object({
  pathParameters: Joi.object().required().keys({
    id: Joi.string().pattern(/^[a-fA-F0-9.]+$/).required()
  })
})
const processMessageEventSchema = Joi.object({
  bodyXml: Joi.string().required()
})

module.exports = {
  getMessageEventSchema,
  processMessageEventSchema
}
