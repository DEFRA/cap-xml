'use strict'

const Joi = require('joi')
const configSchema = require('../config/schema')
const additionalCapMessageSchema = require('../lib/schemas/additionalCapMessageSchema')
const getMessageEventSchema = require('../lib/schemas/getMessageEventSchema')
const processMessageEventSchema = require('../lib/schemas/processMessageEventSchema')

describe('schemas', () => {
  describe('configSchema', () => {
    const validConfig = () => ({
      aws: {
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        accountId: '123',
        sessionToken: 'token',
        region: 'eu-west-2',
        stage: 'dev',
        rdsConnectionString: 'postgres://localhost'
      },
      url: 'http://localhost'
    })

    it('is a Joi schema', () => {
      expect(Joi.isSchema(configSchema)).toBeTrue()
    })

    it('accepts a valid config', () => {
      expect(configSchema.validate(validConfig()).error).toBeUndefined()
    })

    it.each(['', null])('allows accountId and sessionToken to be %p', (value) => {
      const config = validConfig()
      config.aws.accountId = value
      config.aws.sessionToken = value

      expect(configSchema.validate(config).error).toBeUndefined()
    })

    it.each(['dev', 'tst', 'pre', 'prd'])('accepts stage %s', (stage) => {
      const config = validConfig()
      config.aws.stage = stage

      expect(configSchema.validate(config).error).toBeUndefined()
    })

    it.each([
      ['aws is missing', config => { delete config.aws }, '"aws" is required'],
      ['aws.region is missing', config => { delete config.aws.region }, '"aws.region" is required'],
      ['aws.stage is empty', config => { config.aws.stage = '' }, '"aws.stage" is not allowed to be empty'],
      ['url is not a URI', config => { config.url = 'not a url' }, '"url" must be a valid uri']
    ])('rejects config when %s', (_description, mutate, message) => {
      const config = validConfig()
      mutate(config)

      expect(configSchema.validate(config).error.message).toBe(message)
    })
  })

  describe('additionalCapMessageSchema', () => {
    // Shape matches xml2js output, where every element is an array
    const validMessage = () => ({
      alert: {
        identifier: ['id'],
        sender: ['www.gov.uk/environment-agency'],
        source: ['source'],
        info: [{
          event: ['event'],
          severity: ['Minor'],
          senderName: ['Environment Agency'],
          area: [{ areaDesc: ['area'], polygon: ['points'] }]
        }]
      }
    })

    it('accepts a valid message', () => {
      expect(additionalCapMessageSchema.validate(validMessage()).error).toBeUndefined()
    })

    it.each([
      ['alert.identifier', m => m.alert.identifier],
      ['alert.sender', m => m.alert.sender],
      ['alert.source', m => m.alert.source],
      ['alert.info[0].event', m => m.alert.info[0].event],
      ['alert.info[0].severity', m => m.alert.info[0].severity],
      ['alert.info[0].senderName', m => m.alert.info[0].senderName],
      ['alert.info[0].area[0].areaDesc', m => m.alert.info[0].area[0].areaDesc]
    ])('rejects more than one %s', (field, getField) => {
      const message = validMessage()
      const values = getField(message)
      values.push(values[0])

      const { error } = additionalCapMessageSchema.validate(message)

      expect(error.details[0].type).toBe('array.max')
      expect(error.message).toBe(`"${field}" must contain less than or equal to 1 items`)
    })

    it('allows more than one polygon', () => {
      const message = validMessage()
      message.alert.info[0].area[0].polygon.push('more points')

      expect(additionalCapMessageSchema.validate(message).error).toBeUndefined()
    })
  })

  describe('getMessageEventSchema', () => {
    it('is a Joi schema', () => {
      expect(Joi.isSchema(getMessageEventSchema)).toBeTrue()
    })

    it('accepts a hexadecimal id', () => {
      const data = { pathParameters: { id: 'a1b2c3d4' } }
      const { error, value } = getMessageEventSchema.validate(data)

      expect(error).toBeUndefined()
      expect(value).toEqual(data)
    })

    it('rejects a non-hexadecimal id', () => {
      const { error } = getMessageEventSchema.validate({ pathParameters: { id: 'invalid' } })

      expect(error).toBeInstanceOf(Error)
      expect(error.details[0].message).toContain('must only contain hexadecimal characters')
    })

    it('rejects an id containing invalid characters', () => {
      const { error } = getMessageEventSchema.validate({ pathParameters: { id: 'invalid_hex' } })

      expect(error).toBeInstanceOf(Error)
    })

    it('rejects a missing id', () => {
      const { error } = getMessageEventSchema.validate({ pathParameters: {} })

      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('processMessageEventSchema', () => {
    it('is a Joi schema', () => {
      expect(Joi.isSchema(processMessageEventSchema)).toBeTrue()
    })

    it('accepts a string bodyXml', () => {
      const data = { bodyXml: '<xml />' }

      expect(processMessageEventSchema.validate(data)).toEqual({ value: data })
    })

    it('rejects a missing bodyXml', () => {
      const { error } = processMessageEventSchema.validate({})

      expect(error).toBeInstanceOf(Error)
    })

    it('rejects a non-string bodyXml', () => {
      const { error } = processMessageEventSchema.validate({ bodyXml: 123 })

      expect(error).toBeInstanceOf(Error)
      expect(error.details[0].message).toContain('must be a string')
    })
  })
})
