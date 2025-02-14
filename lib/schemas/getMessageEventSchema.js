'use strict'

const Joi = require('joi')

module.exports = Joi.object({
  pathParameters: Joi.object().required().keys({
    id: Joi.string().hex().required()
  })
})
