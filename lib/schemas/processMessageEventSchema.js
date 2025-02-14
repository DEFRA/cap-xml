'use strict'

const Joi = require('joi')

module.exports = Joi.object({
  bodyXml: Joi.string().required()
})
