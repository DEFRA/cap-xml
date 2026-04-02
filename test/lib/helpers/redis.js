'use strict'

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const sinon = require('sinon')
const Proxyquire = require('proxyquire')

const lab = exports.lab = Lab.script()

const ORIGINAL_ENV = process.env

lab.experiment('redis helper', () => {
  let redis
  let mockRedisInstance
  let mockRedis

  lab.beforeEach(() => {
    // Mock environment
    process.env = { ...ORIGINAL_ENV }
    process.env.CPX_REDIS_HOST = 'mock-redis-host'
    process.env.CPX_REDIS_PORT = '6379'

    // Mock ioredis client
    mockRedisInstance = {
      get: sinon.stub(),
      set: sinon.stub(),
      setex: sinon.stub(),
      on: sinon.stub(),
      status: 'ready'
    }

    mockRedis = sinon.stub().returns(mockRedisInstance)

    // Load module with mocked ioredis
    redis = Proxyquire('../../../lib/helpers/redis', {
      ioredis: mockRedis
    })
  })

  lab.afterEach(() => {
    sinon.restore()
    process.env = ORIGINAL_ENV
  })

  lab.test('get initializes redis client with correct config', async () => {
    mockRedisInstance.get.resolves(null)

    await redis.get('test-key')

    Code.expect(mockRedis.calledOnce).to.be.true()
    Code.expect(mockRedis.firstCall.args[0]).to.equal({
      host: 'mock-redis-host',
      maxRetriesPerRequest: 3,
      port: '6379',
      connectTimeout: 10000,
      tls: undefined
    })
  })

  lab.test('get initializes redis client with correct config with tls', async () => {
    mockRedisInstance.get.resolves(null)
    process.env.CPX_REDIS_TLS = 'true'
    await redis.get('test-key')

    Code.expect(mockRedis.calledOnce).to.be.true()
    Code.expect(mockRedis.firstCall.args[0]).to.equal({
      host: 'mock-redis-host',
      maxRetriesPerRequest: 3,
      port: '6379',
      connectTimeout: 10000,
      tls: { checkServerIdentity: () => undefined }
    })
  })

  lab.test('get retrieves and parses JSON value', async () => {
    const mockValue = { foo: 'bar', count: 42 }
    mockRedisInstance.get.resolves(JSON.stringify(mockValue))

    const result = await redis.get('test-key')

    Code.expect(mockRedisInstance.get.calledWith('test-key')).to.be.true()
    Code.expect(result).to.equal(mockValue)
  })

  lab.test('get returns string value when not JSON', async () => {
    mockRedisInstance.get.resolves('plain-string-value')

    const result = await redis.get('test-key')

    Code.expect(result).to.equal('plain-string-value')
  })

  lab.test('get returns string value when JSON.parse fails', async () => {
    mockRedisInstance.get.resolves('{invalid json')

    const result = await redis.get('test-key')

    Code.expect(result).to.equal('{invalid json')
  })

  lab.test('get returns null when key does not exist', async () => {
    mockRedisInstance.get.resolves(null)

    const result = await redis.get('non-existent-key')

    Code.expect(result).to.be.null()
  })

  lab.test('set stores object as JSON string', async () => {
    const mockObject = { foo: 'bar', count: 42 }
    mockRedisInstance.set.resolves('OK')

    await redis.set('test-key', mockObject)

    Code.expect(mockRedisInstance.set.calledWith('test-key', JSON.stringify(mockObject))).to.be.true()
  })

  lab.test('set stores string value directly', async () => {
    mockRedisInstance.set.resolves('OK')

    await redis.set('test-key', 'string-value')

    Code.expect(mockRedisInstance.set.calledWith('test-key', 'string-value')).to.be.true()
  })

  lab.test('set uses setex when ttl is 0', async () => {
    mockRedisInstance.setex.resolves('OK')

    await redis.set('test-key', 'value', 0)

    Code.expect(mockRedisInstance.set.called).to.be.true()
    Code.expect(mockRedisInstance.setex.called).to.be.false()
  })

  lab.test('set stores number value directly', async () => {
    mockRedisInstance.set.resolves('OK')

    await redis.set('test-key', 12345)

    Code.expect(mockRedisInstance.set.calledWith('test-key', 12345)).to.be.true()
  })

  lab.test('recreates client when status is end', async () => {
    // First call creates client
    mockRedisInstance.get.resolves('value1')
    await redis.get('key1')

    Code.expect(mockRedis.calledOnce).to.be.true()

    // Simulate client ending
    mockRedisInstance.status = 'end'

    // Second call should recreate client
    await redis.get('key2')

    Code.expect(mockRedis.calledTwice).to.be.true()
  })

  lab.test('recreates client when status is close', async () => {
    // First call creates client
    mockRedisInstance.get.resolves('value1')
    await redis.get('key1')

    Code.expect(mockRedis.calledOnce).to.be.true()

    // Simulate client closing
    mockRedisInstance.status = 'close'

    // Second call should recreate client
    await redis.get('key2')

    Code.expect(mockRedis.calledTwice).to.be.true()
  })

  lab.test('registers error event handler on client', async () => {
    mockRedisInstance.get.resolves(null)

    await redis.get('test-key')

    Code.expect(mockRedisInstance.on.calledWith('error')).to.be.true()
  })

  lab.test('registers connect event handler on client', async () => {
    mockRedisInstance.get.resolves(null)

    await redis.get('test-key')

    Code.expect(mockRedisInstance.on.calledWith('connect')).to.be.true()
  })

  lab.test('error handler logs errors', async () => {
    const consoleErrorStub = sinon.stub(console, 'error')
    mockRedisInstance.get.resolves(null)

    await redis.get('test-key')

    const errorHandler = mockRedisInstance.on.getCalls().find(call => call.args[0] === 'error')
    const mockError = new Error('Connection failed')
    errorHandler.args[1](mockError)

    Code.expect(consoleErrorStub.calledWith('[redis] Connection error:', mockError)).to.be.true()

    consoleErrorStub.restore()
  })

  lab.test('connect handler logs success', async () => {
    const consoleLogStub = sinon.stub(console, 'log')
    mockRedisInstance.get.resolves(null)

    await redis.get('test-key')

    const connectHandler = mockRedisInstance.on.getCalls().find(call => call.args[0] === 'connect')
    connectHandler.args[1]()

    Code.expect(consoleLogStub.calledWith('[redis] Connected successfully')).to.be.true()

    consoleLogStub.restore()
  })

  lab.test('get initializes client automatically on first call', async () => {
    mockRedisInstance.get.resolves('"test-value"')

    await redis.get('test-key')

    Code.expect(mockRedis.called).to.be.true()
  })

  lab.test('set initializes client automatically on first call', async () => {
    mockRedisInstance.set.resolves('OK')

    await redis.set('test-key', 'value')

    Code.expect(mockRedis.called).to.be.true()
  })

  lab.test('reuses existing client across multiple calls', async () => {
    mockRedisInstance.get.resolves(null)
    mockRedisInstance.set.resolves('OK')

    await redis.get('key1')
    await redis.set('key2', 'value')
    await redis.get('key3')

    Code.expect(mockRedis.calledOnce).to.be.true()
  })
})
