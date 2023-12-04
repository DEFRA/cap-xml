'use strict'

const Joi = require('joi')
const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const configSchema = require('../config/schema')
const { getMessageEventSchema, processMessageEventSchema } = require('../lib/helpers/schemas')

lab.experiment('schemas', () => {
  lab.test('configSchema', () => {
    Code.expect(Joi.isSchema(configSchema)).to.equal(true)
  })

  lab.test('getMessageEventSchema', () => {
    Code.expect(Joi.isSchema(getMessageEventSchema)).to.equal(true)
  })

  lab.test('getMessageEventSchema with invalid data', () => {
    const invalidSampleData = { pathParameters: { id: 'invalid_hex' } }
    const validationResult = getMessageEventSchema.validate(invalidSampleData)

    Code.expect(validationResult.error).to.not.be.null()
  })

  lab.test('getMessageEventSchema with missing id', () => {
    const dataWithoutId = { pathParameters: {} }
    const validationResult = getMessageEventSchema.validate(dataWithoutId)

    Code.expect(validationResult.error).to.not.be.null()
  })

  lab.test('processMessageEventSchema', () => {
    Code.expect(Joi.isSchema(processMessageEventSchema)).to.equal(true)
    Code.expect(processMessageEventSchema.validate({ bodyXml: '<xml />' })).to.equal({ value: { bodyXml: '<xml />' } })
  })
})
