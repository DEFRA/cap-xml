'use strict'

const Joi = require('joi')

module.exports = Joi.object().required().keys({
  aws: Joi.object().required().keys({
    accessKeyId: Joi.string().required(),
    secretAccessKey: Joi.string().required(),
    accountId: Joi.string().required().allow('', null),
    sessionToken: Joi.string().required().allow('', null),
    region: Joi.string().required(),
    stage: Joi.string().required().allow('dv', 'qa', 'pp', 'ea'),
    rdsConnectionString: Joi.string().required()
  })
})
