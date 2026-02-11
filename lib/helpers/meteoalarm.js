'use strict'

const axios = require('axios')
const https = require('https')
let cachedToken = null
let tokenExpiry = null
const CPX_METEOALARM_API_URL = process.env.CPX_METEOALARM_API_URL
const CPX_METEOALARM_API_USERNAME = process.env.CPX_METEOALARM_API_USERNAME
const CPX_METEOALARM_API_PASSWORD = process.env.CPX_METEOALARM_API_PASSWORD
const MAX_RETRIES = 3
const config = {
  retryDelayMultiplier: 1000 // Default 1000ms, can be overridden for testing
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
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    })

    if (response.status !== 200) {
      throw new Error(`Failed to authenticate: ${response.status} ${response.statusText}`)
    }

    cachedToken = response.data.token
    // Set token expiry to 1 hour from now
    tokenExpiry = new Date(Date.now() + 3600000)
    return cachedToken
  } catch (err) {
    console.error('Error fetching bearer token:', err.message)
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
        timeout: 10000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      })

      if (response.status === 201) {
        console.log(`Successfully posted warning to Meteoalarm: ${identifier}`)
        console.log(response.data)
        return response.data
      }
      throw new Error(`Received non-201 response: ${response.status}`)
    } catch (err) {
      lastError = err
      console.error(`Meteoalarm post attempt ${attempt} failed: ${err.message}`)
      if (err.response?.data) {
        console.error(JSON.stringify(err.response.data))
      }

      // If it's a 401 error, clear the cached token and retry
      if (err.response?.status === 401) {
        console.log('Received 401, clearing cached token')
        cachedToken = null
        tokenExpiry = null
      }

      // If this isn't the last attempt, wait before retrying
      if (attempt < MAX_RETRIES) {
        const delayMs = attempt * config.retryDelayMultiplier
        console.log(`Waiting ${delayMs}ms before retry...`)
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
