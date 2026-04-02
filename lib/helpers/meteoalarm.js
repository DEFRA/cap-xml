'use strict'

const axios = require('axios')
let cachedToken = null
let tokenExpiry = null
const CPX_METEOALARM_API_URL = process.env.CPX_METEOALARM_API_URL
const CPX_METEOALARM_API_USERNAME = process.env.CPX_METEOALARM_API_USERNAME
const CPX_METEOALARM_API_PASSWORD = process.env.CPX_METEOALARM_API_PASSWORD
const MAX_RETRIES = 3
const TOKEN_EXPIRY_MS = 3600000 // 1 hour in milliseconds
const API_REQUEST_TIMEOUT_MS = 10000 // 10 seconds
const DEFAULT_RETRY_DELAY_MULTIPLIER = 1000 // 1 second base delay
const HTTP_STATUS_OK = 200
const HTTP_STATUS_CREATED = 201
const HTTP_STATUS_UNAUTHORIZED = 401
const config = {
  retryDelayMultiplier: DEFAULT_RETRY_DELAY_MULTIPLIER // Can be overridden for testing
}

const getValidToken = async () => {
  // Check if we have a cached token that hasn't expired
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken
  }

  try {
    const response = await axios.post(`${CPX_METEOALARM_API_URL}/tokens`, {
      username: CPX_METEOALARM_API_USERNAME,
      password: CPX_METEOALARM_API_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.status !== HTTP_STATUS_OK) {
      throw new Error(`Failed to authenticate: ${response.status} ${response.statusText}`)
    }

    cachedToken = response.data.token
    // Set token expiry to 1 hour from now
    tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS)
    console.log('[meteoalarm] Successfully authenticated and obtained bearer token')
    return cachedToken
  } catch (err) {
    console.error('[meteoalarm] Error fetching bearer token:', err.message)
    throw new Error(`Failed to authenticate with Meteoalarm: ${err.message}`)
  }
}

const postWarning = async (xmlMessage, identifier) => {
  let lastError = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = await getValidToken()
      const response = await axios.post(`${CPX_METEOALARM_API_URL}/warnings`, xmlMessage, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xml'
        },
        timeout: API_REQUEST_TIMEOUT_MS
      })

      if (response.status === HTTP_STATUS_CREATED) {
        console.log(`[meteoalarm] Successfully posted warning: ${identifier}`)
        console.log('[meteoalarm] Response:', response.data)
        return response.data
      }
      throw new Error(`Received non-201 response: ${response.status}`)
    } catch (err) {
      lastError = err
      console.error(`[meteoalarm] Post attempt ${attempt} failed: ${err.message}`)
      if (err.response?.data) {
        console.error('[meteoalarm] Error response:', JSON.stringify(err.response.data))
      }

      // If it's a 401 error, clear the cached token and retry
      if (err.response?.status === HTTP_STATUS_UNAUTHORIZED) {
        console.log('[meteoalarm] Received 401, clearing cached token')
        cachedToken = null
        tokenExpiry = null
      }

      // If this isn't the last attempt, wait before retrying
      if (attempt < MAX_RETRIES) {
        const delayMs = attempt * config.retryDelayMultiplier
        console.log(`[meteoalarm] Waiting ${delayMs}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }
  throw new Error(`Failed to post warning to Meteoalarm after ${MAX_RETRIES} attempts: ${lastError.message}`)
}

const clearTokenCache = () => {
  cachedToken = null
  tokenExpiry = null
}

const setRetryDelayMultiplier = (multiplier) => {
  config.retryDelayMultiplier = multiplier
}

module.exports = {
  postWarning,
  clearTokenCache,
  // Export for testing
  getValidToken,
  setRetryDelayMultiplier
}
