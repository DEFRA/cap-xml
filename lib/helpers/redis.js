'use strict'

const Redis = require('ioredis')
let client

const getClient = () => {
  if (!client || client.status === 'end' || client.status === 'close') {
    client = new Redis({
      host: process.env.CPX_REDIS_HOST,
      port: process.env.CPX_REDIS_PORT || 6379,
      connectTimeout: 10000
    })

    client.on('error', (error) => {
      console.error('Redis connection error:', error)
    })

    client.on('connect', () => {
      console.log('Redis connected successfully')
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
      // If parsing fails, return raw string value
      return value
    }
  },
  set: async (key, value, ttl = null) => {
    const redisClient = getClient()
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value
    if (ttl) {
      return redisClient.setex(key, ttl, serializedValue)
    }
    return redisClient.set(key, serializedValue)
  }
}
