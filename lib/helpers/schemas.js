'use strict'

const Joi = require('joi')

const getMessageEventSchema = Joi.object().required().keys({
  pathParameters: Joi.object().required().keys({
    id: Joi.string().hex().required()
  })
})
const processMessageEventSchema = Joi.object().required().keys({
  bodyXml: Joi.string().required()
})

module.exports = {
  getMessageEventSchema: getMessageEventSchema,
  processMessageEventSchema: processMessageEventSchema
}
