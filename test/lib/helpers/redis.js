'use strict'

jest.mock('ioredis', () => jest.fn())

const ORIGINAL_ENV = process.env

describe('redis helper', () => {
  let redis
  let Redis
  let mockRedisInstance

  const getHandler = (eventName) => mockRedisInstance.on.mock.calls.find(([name]) => name === eventName)[1]

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...ORIGINAL_ENV,
      CPX_REDIS_HOST: 'mock-redis-host',
      CPX_REDIS_PORT: '6379'
    }
    delete process.env.CPX_REDIS_TLS

    mockRedisInstance = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      status: 'ready'
    }
    Redis = require('ioredis')
    Redis.mockImplementation(() => mockRedisInstance)

    redis = require('../../../lib/helpers/redis')
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('client initialisation', () => {
    it('creates the client with the correct config', async () => {
      await redis.get('test-key')

      expect(Redis).toHaveBeenCalledExactlyOnceWith({
        host: 'mock-redis-host',
        port: '6379',
        tls: undefined,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000
      })
    })

    it('creates the client with tls when CPX_REDIS_TLS is "true"', async () => {
      process.env.CPX_REDIS_TLS = 'true'

      await redis.get('test-key')

      expect(Redis).toHaveBeenCalledExactlyOnceWith({
        host: 'mock-redis-host',
        port: '6379',
        tls: { checkServerIdentity: expect.any(Function) },
        maxRetriesPerRequest: 3,
        connectTimeout: 10000
      })
      expect(Redis.mock.calls[0][0].tls.checkServerIdentity()).toBeUndefined()
    })

    it('initialises the client automatically on first set', async () => {
      await redis.set('test-key', 'value')

      expect(Redis).toHaveBeenCalledOnce()
    })

    it('reuses the existing client across multiple calls', async () => {
      await redis.get('key1')
      await redis.set('key2', 'value')
      await redis.get('key3')

      expect(Redis).toHaveBeenCalledOnce()
    })

    it.each(['end', 'close'])('recreates the client when status is %s', async (status) => {
      await redis.get('key1')
      mockRedisInstance.status = status

      await redis.get('key2')

      expect(Redis).toHaveBeenCalledTimes(2)
    })

    it('logs connection errors', async () => {
      await redis.get('test-key')
      const error = new Error('Connection failed')

      getHandler('error')(error)

      expect(console.error).toHaveBeenCalledWith('[redis] Connection error:', error)
    })

    it('logs successful connections', async () => {
      await redis.get('test-key')

      getHandler('connect')()

      expect(console.log).toHaveBeenCalledWith('[redis] Connected successfully')
    })
  })

  describe('get', () => {
    it('retrieves and parses a JSON value', async () => {
      const mockValue = { foo: 'bar', count: 42 }
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(mockValue))

      await expect(redis.get('test-key')).resolves.toEqual(mockValue)
      expect(mockRedisInstance.get).toHaveBeenCalledExactlyOnceWith('test-key')
    })

    it('returns the raw value when it is not JSON', async () => {
      mockRedisInstance.get.mockResolvedValue('plain-string-value')

      await expect(redis.get('test-key')).resolves.toBe('plain-string-value')
      expect(console.error).toHaveBeenCalledWith('[redis] Failed to parse value for key test-key:', expect.any(SyntaxError))
    })

    it('returns the raw value when JSON parsing fails', async () => {
      mockRedisInstance.get.mockResolvedValue('{invalid json')

      await expect(redis.get('test-key')).resolves.toBe('{invalid json')
    })

    it('returns null when the key does not exist', async () => {
      await expect(redis.get('non-existent-key')).resolves.toBeNull()
    })
  })

  describe('set', () => {
    it('stores an object as a JSON string', async () => {
      const mockObject = { foo: 'bar', count: 42 }

      await expect(redis.set('test-key', mockObject)).resolves.toBe('OK')
      expect(mockRedisInstance.set).toHaveBeenCalledExactlyOnceWith('test-key', JSON.stringify(mockObject))
    })

    it('stores a string value directly', async () => {
      await redis.set('test-key', 'string-value')

      expect(mockRedisInstance.set).toHaveBeenCalledExactlyOnceWith('test-key', 'string-value')
    })

    it('stores a number value directly', async () => {
      await redis.set('test-key', 12345)

      expect(mockRedisInstance.set).toHaveBeenCalledExactlyOnceWith('test-key', 12345)
    })
  })
})
