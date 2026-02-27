'use strict'

const service = require('../helpers/service')
const eventSchema = require('../schemas/getMessageEventSchema')
const { validateXML } = require('xmllint-wasm')
const fs = require('node:fs')
const path = require('node:path')
const xsdSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'CAP-v1.2.xsd'), 'utf8')
const redis = require('../helpers/redis')

module.exports.getMessage = async (event, v2) => {
  console.log('[getMessage] Event received:', event)
  const { error } = eventSchema.validate(event)

  if (error) {
    throw error
  }

  // Fetch message from redis, else get from postgres
  let body
  const key = event.pathParameters.id
  console.log(`[getMessage] Fetching message with id: ${key}, version: ${v2 ? 'v2' : 'v1'}`)
  const fetchStart = Date.now()
  const cachedMessage = await redis.get(key)

  if (cachedMessage) {
    console.log(`[getMessage] Cache HIT for ${key}`)
    body = v2 ? cachedMessage.alert_v2 : cachedMessage.alert
  } else {
    console.log(`[getMessage] Cache MISS for ${key}, fetching from database`)
    const ret = await service.getMessage(key)
    if (!ret?.rows || !Array.isArray(ret.rows) || ret.rows.length < 1 || !ret.rows[0].getmessage) {
      console.log('[getMessage] No message found for ' + key)
      throw new Error('No message found')
    }
    const message = ret.rows[0].getmessage
    body = v2 ? message.alert_v2 : message.alert
    // Cache the message in redis
    await redis.set(key, message)
    console.log(`[getMessage] Retrieved from database and cached: ${key}`)
  }
  console.log(`[getMessage] Message retrieved in ${Date.now() - fetchStart}ms for ${key}`)

  const validationResult = await validateXML({
    xml: [{
      fileName: 'message.xml',
      contents: body
    }],
    schema: [xsdSchema]
  })

  // NI-95 log validation errors and continue processing
  if (validationResult.errors?.length > 0) {
    console.log('[getMessage] CAP get message failed validation')
    console.log('[getMessage] Validation errors:', JSON.stringify(validationResult.errors))
  }

  console.log(`[getMessage] Returning message ${key}, size: ${body.length} bytes`)
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    },
    body
  }
}
