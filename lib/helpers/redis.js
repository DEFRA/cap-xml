'use strict'

const Redis = require('ioredis')
let client

const getClient = () => {
  if (!client || client.status === 'end' || client.status === 'close') {
    client = new Redis({
      host: process.env.CPX_REDIS_HOST,
      port: process.env.CPX_REDIS_PORT,
      tls: process.env.CPX_REDIS_TLS === 'true' ? { checkServerIdentity: () => undefined } : undefined,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000
    })

    client.on('error', (error) => {
      console.error('[redis] Connection error:', error)
    })

    client.on('connect', () => {
      console.log('[redis] Connected successfully')
    })
  }
  return client
}

module.exports = {
  get: async (key) => {
    const redisClient = getClient()
    const value = await redisClient.get(key)
    if (value === null) {
      return null
    }
    try {
      return JSON.parse(value)
    } catch (error) {
      console.error(`[redis] Failed to parse value for key ${key}:`, error)
      return value
    }
  },
  set: async (key, value) => {
    const redisClient = getClient()
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value
    return redisClient.set(key, serializedValue)
  }
}
