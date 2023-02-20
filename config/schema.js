'use strict'

const Joi = require('@hapi/joi')

module.exports = Joi.object({
  aws: Joi.object().required().keys({
    accessKeyId: Joi.string().required(),
    secretAccessKey: Joi.string().required(),
    accountId: Joi.string().required().allow('', null),
    sessionToken: Joi.string().required().allow('', null),
    region: Joi.string().required(),
    stage: Joi.string().required().allow('dev', 'tst', 'pre', 'prd'),
    rdsConnectionString: Joi.string().required()
  }),
  url: Joi.string().uri().required()
})
