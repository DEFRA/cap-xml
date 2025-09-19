// This joi schema is to cover additional validation rules from NI-113
// loose validation with unknown(true) is used to ignore fields covered by XSD validation
const Joi = require('joi')

const areaSchema = Joi.object({
  areaDesc: Joi.array().items(Joi.string().min(1)).max(1).required(),
  polygon: Joi.array().items(Joi.string().min(1)).required()
}).unknown(true)

const infoSchema = Joi.object({
  event: Joi.array().items(Joi.string().min(1)).max(1).required(),
  senderName: Joi.array().items(Joi.string().min(1)).max(1).required(),
  area: Joi.array().items(areaSchema)
}).unknown(true)

const messageSchema = Joi.object({
  alert: Joi.object({
    identifier: Joi.array().items(Joi.string().min(1)).max(1).required(),
    sender: Joi.array().items(Joi.string().equal('www.gov.uk/environment-agency')).max(1).required(),
    source: Joi.array().items(Joi.string().min(1)).max(1).required(),
    info: Joi.array().items(infoSchema)
  }).unknown(true)
})

module.exports = messageSchema
