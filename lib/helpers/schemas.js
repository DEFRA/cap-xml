'use strict'

const Joi = require('joi')

const getMessageEventSchema = Joi.object({
  pathParameters: Joi.object().required().keys({
    id: Joi.string().hex().required()
  })
})
const processMessageEventSchema = Joi.object({
  bodyXml: Joi.string().required()
})

module.exports = {
  getMessageEventSchema,
  processMessageEventSchema
}
