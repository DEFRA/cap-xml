'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { getMessage } = require('../../../lib/helpers/message')
const service = require('../../../lib/helpers/service')
const redis = require('../../../lib/helpers/redis')

const readData = (fileName) => fs.readFileSync(path.join(__dirname, '..', 'functions', 'data', fileName), 'utf8')
const getMessageXmlInvalid = readData('getMessage-invalid.xml')
const getMessageXmlValid = readData('getMessage-valid.xml')

const ID = '4eb3b7350ab7aa443650fc9351f'
const alertXml = (content) => `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">${content}</alert>`
const dbResult = (getmessage) => ({ rows: [{ getmessage }] })

describe('getMessage helper', () => {
  let event

  beforeEach(() => {
    event = { pathParameters: { id: ID } }
    jest.spyOn(redis, 'get').mockResolvedValue(null)
    jest.spyOn(redis, 'set').mockResolvedValue('OK')
    jest.spyOn(service, 'getMessage').mockResolvedValue(dbResult({
      alert: alertXml('test'),
      alert_v2: alertXml('test v2')
    }))
  })

  describe.each([
    { version: 'v1', v2: false, alertField: 'alert', expectedBody: alertXml('test') },
    { version: 'v2', v2: true, alertField: 'alert_v2', expectedBody: alertXml('test v2') }
  ])('getMessage $version (v2=$v2)', ({ v2, alertField, expectedBody }) => {
    it('returns the alert for the requested version', async () => {
      await expect(getMessage(event, v2)).resolves.toEqual({
        statusCode: 200,
        headers: { 'content-type': 'application/xml' },
        body: expectedBody
      })
      expect(service.getMessage).toHaveBeenCalledExactlyOnceWith(ID)
    })

    it.each([
      ['no rows are found', { rows: [] }],
      ['rows is not an array', { rows: 1 }],
      ['getmessage is empty', { rows: [{}] }],
      ['rows are missing', { no_rows: [] }],
      ['nothing is returned', undefined]
    ])('rejects when %s', async (_description, result) => {
      service.getMessage.mockResolvedValue(result)

      await expect(getMessage(event, v2)).rejects.toThrow('No message found')
      expect(console.log).toHaveBeenCalledWith(`[getMessage] No message found for ${ID}`)
    })

    it('rejects when the database errors', async () => {
      service.getMessage.mockRejectedValue(new Error('test error'))

      await expect(getMessage(event, v2)).rejects.toThrow('test error')
    })

    it('rejects when pathParameters are missing', async () => {
      await expect(getMessage({}, v2)).rejects.toThrow('"pathParameters" is required')
    })

    it('rejects when the event has unexpected properties', async () => {
      event.id = {}

      await expect(getMessage(event, v2)).rejects.toThrow('"id" is not allowed')
    })

    it('rejects an id that is not hexadecimal', async () => {
      event.pathParameters.id = 'invalid_id_format'

      await expect(getMessage(event, v2)).rejects.toThrow('must only contain hexadecimal characters')
    })

    it('accepts a valid hexadecimal id', async () => {
      event.pathParameters.id = 'a1b2c3'

      const { body } = await getMessage(event, v2)

      expect(body).toBe(expectedBody)
      expect(service.getMessage).toHaveBeenCalledExactlyOnceWith('a1b2c3')
    })

    it('logs XSD validation errors for an invalid alert but still returns it', async () => {
      service.getMessage.mockResolvedValue(dbResult({ [alertField]: getMessageXmlInvalid }))

      const { statusCode, body } = await getMessage(event, v2)

      expect(statusCode).toBe(200)
      expect(body).toBe(getMessageXmlInvalid)
      expect(console.log).toHaveBeenCalledWith('[getMessage] CAP get message failed validation')
      expect(console.log).toHaveBeenCalledWith('[getMessage] Validation errors:', expect.stringContaining('Schemas validity error'))
    })

    it('does not log validation errors for a valid alert', async () => {
      service.getMessage.mockResolvedValue(dbResult({ [alertField]: getMessageXmlValid }))

      await getMessage(event, v2)

      expect(console.log).not.toHaveBeenCalledWith('[getMessage] CAP get message failed validation')
    })
  })

  describe('behaviour differences between versions', () => {
    it('returns different content for v1 and v2 with the same status and headers', async () => {
      const retV1 = await getMessage(event, false)
      const retV2 = await getMessage(event, true)

      expect(retV1.body).not.toBe(retV2.body)
      expect(retV1.statusCode).toBe(retV2.statusCode)
      expect(retV1.headers).toEqual(retV2.headers)
    })
  })

  describe('redis caching', () => {
    const cachedMessage = {
      alert: alertXml('cached v1'),
      alert_v2: alertXml('cached v2')
    }

    it.each([
      [false, cachedMessage.alert],
      [true, cachedMessage.alert_v2]
    ])('uses the cached message when available (v2=%s)', async (v2, expectedBody) => {
      redis.get.mockResolvedValue(cachedMessage)

      const { body } = await getMessage(event, v2)

      expect(body).toBe(expectedBody)
      expect(redis.get).toHaveBeenCalledExactlyOnceWith(ID)
      expect(service.getMessage).not.toHaveBeenCalled()
      expect(redis.set).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(`[getMessage] Cache HIT for ${ID}`)
    })

    it('fetches from the database and caches the whole message on a cache miss', async () => {
      const dbMessage = {
        alert: alertXml('db v1'),
        alert_v2: alertXml('db v2'),
        extraField: 'should be cached too'
      }
      service.getMessage.mockResolvedValue(dbResult(dbMessage))

      const { body } = await getMessage(event, false)

      expect(body).toBe(dbMessage.alert)
      expect(redis.get).toHaveBeenCalledExactlyOnceWith(ID)
      expect(redis.set).toHaveBeenCalledExactlyOnceWith(ID, dbMessage)
    })

    it('does not cache when the database returns no results', async () => {
      service.getMessage.mockResolvedValue({ rows: [] })

      await expect(getMessage(event, false)).rejects.toThrow('No message found')
      expect(redis.set).not.toHaveBeenCalled()
    })

    it('does not cache when the database throws an error', async () => {
      service.getMessage.mockRejectedValue(new Error('DB error'))

      await expect(getMessage(event, false)).rejects.toThrow('DB error')
      expect(redis.set).not.toHaveBeenCalled()
    })

    it('uses the id from the event pathParameters as the cache key', async () => {
      event.pathParameters.id = 'abc123def456'
      redis.get.mockResolvedValue(cachedMessage)

      await getMessage(event, false)

      expect(redis.get).toHaveBeenCalledExactlyOnceWith('abc123def456')
      expect(service.getMessage).not.toHaveBeenCalled()
    })
  })
})
