'use strict'

const Joi = require('joi')
const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const configSchema = require('../config/schema')
const getMessageEventSchema = require('../lib/schemas/getMessageEventSchema')
const processMessageEventSchema = require('../lib/schemas/processMessageEventSchema')

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
  lab.test('processMessageEventSchema with valid data', () => {
    const validSampleData = { bodyXml: '<xml />' }
    const validationResult = processMessageEventSchema.validate(validSampleData)

    Code.expect(validationResult.error).to.not.exist()
    Code.expect(validationResult.value).to.equal(validSampleData)
  })

  lab.test('processMessageEventSchema with missing bodyXml', () => {
    const dataWithoutBodyXml = {}
    const validationResult = processMessageEventSchema.validate(dataWithoutBodyXml)

    Code.expect(validationResult.error).to.not.be.null()
  })

  lab.test('processMessageEventSchema with invalid bodyXml', () => {
    const invalidSampleData = { bodyXml: 123 }
    const validationResult = processMessageEventSchema.validate(invalidSampleData)

    Code.expect(validationResult.error).to.not.be.null()
  })
  lab.test('modules export the schemas correctly and validate their behavior', () => {
    // Test valid data for getMessageEventSchema
    const validGetMessageData = { pathParameters: { id: 'a1b2c3d4' } }
    const getMessageValidationResult = getMessageEventSchema.validate(validGetMessageData)
    Code.expect(getMessageValidationResult.error).to.not.exist()
    Code.expect(getMessageValidationResult.value).to.equal(validGetMessageData)

    // Test invalid data for getMessageEventSchema
    const invalidGetMessageData = { pathParameters: { id: 'invalid' } }
    const invalidGetMessageResult = getMessageEventSchema.validate(invalidGetMessageData)
    Code.expect(invalidGetMessageResult.error).to.not.be.null()
    Code.expect(invalidGetMessageResult.error.details[0].message).to.contain('must only contain hexadecimal characters')

    // Test valid data for processMessageEventSchema
    const validProcessMessageData = { bodyXml: '<xml />' }
    const processMessageValidationResult = processMessageEventSchema.validate(validProcessMessageData)
    Code.expect(processMessageValidationResult.error).to.not.exist()
    Code.expect(processMessageValidationResult.value).to.equal(validProcessMessageData)

    // Test invalid data for processMessageEventSchema
    const invalidProcessMessageData = { bodyXml: 123 }
    const invalidProcessMessageResult = processMessageEventSchema.validate(invalidProcessMessageData)
    Code.expect(invalidProcessMessageResult.error).to.not.be.null()
    Code.expect(invalidProcessMessageResult.error.details[0].message).to.contain('must be a string')
  })
})
