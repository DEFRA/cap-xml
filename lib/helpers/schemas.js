'use strict'

const Joi = require('@hapi/joi')

const getMessageEventSchema = Joi.object({
  pathParameters: Joi.object().required().keys({
    id: Joi.string().hex().required()
  })
})
const processMessageEventSchema = Joi.object({
  bodyXml: Joi.string().required()
})

module.exports = {
  getMessageEventSchema: getMessageEventSchema,
  processMessageEventSchema: processMessageEventSchema
}
