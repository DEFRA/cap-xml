'use strict'

jest.mock('axios', () => ({ post: jest.fn() }))

const ORIGINAL_ENV = process.env
const API_URL = 'https://test-meteoalarm.example.com'
const TOKENS_URL = `${API_URL}/tokens`
const WARNINGS_URL = `${API_URL}/warnings`
const XML_MESSAGE = '<alert><identifier>test-id</identifier></alert>'
const IDENTIFIER = 'test-id'

const httpError = (message, response) => Object.assign(new Error(message), { response })

describe('meteoalarm helper', () => {
  let meteoalarm
  let axios

  // Routes mocked axios.post calls by URL; each handler receives the call count for that URL
  const mockApi = ({ tokens, warnings }) => {
    const counts = { [TOKENS_URL]: 0, [WARNINGS_URL]: 0 }
    axios.post.mockImplementation((url, data) => {
      counts[url]++
      const handler = url === TOKENS_URL ? tokens : warnings
      return handler(counts[url], data)
    })
    return counts
  }

  const tokenResponse = (token = 'test-token') => () => Promise.resolve({ status: 200, data: { token } })

  beforeEach(() => {
    jest.resetModules()
    // Module reads its configuration at load time
    process.env = {
      ...ORIGINAL_ENV,
      CPX_METEOALARM_API_URL: API_URL,
      CPX_METEOALARM_API_USERNAME: 'test-user',
      CPX_METEOALARM_API_PASSWORD: 'test-password'
    }
    axios = require('axios')
    meteoalarm = require('../../../lib/helpers/meteoalarm')
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('getValidToken', () => {
    it('fetches a new token', async () => {
      axios.post.mockResolvedValue({ status: 200, data: { token: 'test-bearer-token-123' } })

      await expect(meteoalarm.getValidToken()).resolves.toBe('test-bearer-token-123')
      expect(axios.post).toHaveBeenCalledExactlyOnceWith(
        TOKENS_URL,
        { username: 'test-user', password: 'test-password' },
        { headers: { 'Content-Type': 'application/json' } }
      )
      expect(console.log).toHaveBeenCalledWith('[meteoalarm] Successfully authenticated and obtained bearer token')
    })

    it('returns the cached token while it is still valid', async () => {
      axios.post.mockResolvedValue({ status: 200, data: { token: 'cached-token' } })

      await expect(meteoalarm.getValidToken()).resolves.toBe('cached-token')
      await expect(meteoalarm.getValidToken()).resolves.toBe('cached-token')
      expect(axios.post).toHaveBeenCalledOnce()
    })

    it('fetches a new token once the cached token has expired', async () => {
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000)
      axios.post
        .mockResolvedValueOnce({ status: 200, data: { token: 'expired-token' } })
        .mockResolvedValueOnce({ status: 200, data: { token: 'fresh-token' } })

      jest.spyOn(Date, 'now').mockReturnValueOnce(twoHoursAgo)
      await expect(meteoalarm.getValidToken()).resolves.toBe('expired-token')
      await expect(meteoalarm.getValidToken()).resolves.toBe('fresh-token')
      expect(axios.post).toHaveBeenCalledTimes(2)
    })

    it('throws when authentication returns a non-200 status', async () => {
      axios.post.mockResolvedValue({ status: 401, statusText: 'Unauthorized' })

      await expect(meteoalarm.getValidToken()).rejects.toThrow('Failed to authenticate with Meteoalarm: Failed to authenticate: 401 Unauthorized')
      expect(console.error).toHaveBeenCalledWith('[meteoalarm] Error fetching bearer token:', 'Failed to authenticate: 401 Unauthorized')
    })

    it('throws when the request fails', async () => {
      axios.post.mockRejectedValue(new Error('Network error'))

      await expect(meteoalarm.getValidToken()).rejects.toThrow('Failed to authenticate with Meteoalarm: Network error')
    })
  })

  describe('postWarning', () => {
    beforeEach(() => {
      meteoalarm.setRetryDelayMultiplier(0)
    })

    it('posts the warning on the first attempt', async () => {
      mockApi({
        tokens: tokenResponse(),
        warnings: () => Promise.resolve({ status: 201, data: { id: 'warning-123', status: 'created' } })
      })

      await expect(meteoalarm.postWarning(XML_MESSAGE, IDENTIFIER)).resolves.toEqual({ id: 'warning-123', status: 'created' })
      expect(axios.post).toHaveBeenCalledTimes(2)
      expect(axios.post).toHaveBeenLastCalledWith(WARNINGS_URL, XML_MESSAGE, {
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/xml'
        },
        timeout: 10000
      })
      expect(console.log).toHaveBeenCalledWith(`[meteoalarm] Successfully posted warning: ${IDENTIFIER}`)
    })

    it('retries after a failure and succeeds on the second attempt', async () => {
      const counts = mockApi({
        tokens: tokenResponse(),
        warnings: (attempt) => attempt === 1
          ? Promise.reject(httpError('Timeout', { data: { error: 'timeout' } }))
          : Promise.resolve({ status: 201, data: { id: 'warning-123' } })
      })

      await expect(meteoalarm.postWarning(XML_MESSAGE, IDENTIFIER)).resolves.toEqual({ id: 'warning-123' })
      expect(counts[WARNINGS_URL]).toBe(2)
      // Only a 401 invalidates the cached token
      expect(counts[TOKENS_URL]).toBe(1)
      expect(console.log).not.toHaveBeenCalledWith('[meteoalarm] Received 401, clearing cached token')
      expect(console.error).toHaveBeenCalledWith('[meteoalarm] Error response:', JSON.stringify({ error: 'timeout' }))
      expect(console.log).toHaveBeenCalledWith('[meteoalarm] Waiting 0ms before retry...')
    })

    it('clears the cached token on a 401 and retries with a new token', async () => {
      const counts = mockApi({
        tokens: (attempt) => tokenResponse(attempt === 1 ? 'expired-token' : 'fresh-token')(),
        warnings: (attempt) => attempt === 1
          ? Promise.reject(httpError('Unauthorized', { status: 401, data: { error: 'token expired' } }))
          : Promise.resolve({ status: 201, data: { id: 'warning-456' } })
      })

      await expect(meteoalarm.postWarning(XML_MESSAGE, IDENTIFIER)).resolves.toEqual({ id: 'warning-456' })
      expect(counts[TOKENS_URL]).toBe(2)
      expect(axios.post).toHaveBeenLastCalledWith(WARNINGS_URL, XML_MESSAGE, expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' })
      }))
      expect(console.log).toHaveBeenCalledWith('[meteoalarm] Received 401, clearing cached token')
    })

    it('throws after the maximum number of retries', async () => {
      const counts = mockApi({
        tokens: tokenResponse(),
        warnings: () => Promise.reject(httpError('Service unavailable', { data: { error: 'service down' } }))
      })

      await expect(meteoalarm.postWarning(XML_MESSAGE, IDENTIFIER)).rejects.toThrow('Failed to post warning to Meteoalarm after 3 attempts: Service unavailable')
      expect(counts[WARNINGS_URL]).toBe(3)
    })

    it('throws when a non-201 status is received', async () => {
      mockApi({
        tokens: tokenResponse(),
        warnings: () => Promise.resolve({ status: 200, data: { message: 'accepted but not created' } })
      })

      await expect(meteoalarm.postWarning(XML_MESSAGE, IDENTIFIER)).rejects.toThrow('Failed to post warning to Meteoalarm after 3 attempts: Received non-201 response: 200')
    })

    it('handles errors without a response object', async () => {
      mockApi({
        tokens: tokenResponse(),
        warnings: () => Promise.reject(new Error('Network error'))
      })

      await expect(meteoalarm.postWarning(XML_MESSAGE, IDENTIFIER)).rejects.toThrow('Failed to post warning to Meteoalarm after 3 attempts: Network error')
      expect(console.error).not.toHaveBeenCalledWith('[meteoalarm] Error response:', expect.anything())
    })

    it('uses the cached token across multiple warning posts', async () => {
      const counts = mockApi({
        tokens: tokenResponse('shared-token'),
        warnings: (_attempt, data) => Promise.resolve({ status: 201, data: { id: data === XML_MESSAGE ? 'warning-1' : 'warning-2' } })
      })

      await expect(meteoalarm.postWarning(XML_MESSAGE, 'test-id-1')).resolves.toEqual({ id: 'warning-1' })
      await expect(meteoalarm.postWarning('<alert />', 'test-id-2')).resolves.toEqual({ id: 'warning-2' })
      expect(counts[TOKENS_URL]).toBe(1)
    })
  })

  describe('postWarning retry backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('waits 1s then 2s between attempts and does not wait after the final attempt', async () => {
      const counts = mockApi({
        tokens: tokenResponse(),
        warnings: () => Promise.reject(new Error('Service unavailable'))
      })

      const result = expect(meteoalarm.postWarning(XML_MESSAGE, IDENTIFIER)).rejects.toThrow('after 3 attempts')

      await jest.advanceTimersByTimeAsync(0)
      expect(counts[WARNINGS_URL]).toBe(1)

      await jest.advanceTimersByTimeAsync(999)
      expect(counts[WARNINGS_URL]).toBe(1)
      await jest.advanceTimersByTimeAsync(1)
      expect(counts[WARNINGS_URL]).toBe(2)

      await jest.advanceTimersByTimeAsync(1999)
      expect(counts[WARNINGS_URL]).toBe(2)
      await jest.advanceTimersByTimeAsync(1)
      expect(counts[WARNINGS_URL]).toBe(3)

      await result
      expect(jest.getTimerCount()).toBe(0)
      expect(console.log).toHaveBeenCalledWith('[meteoalarm] Waiting 1000ms before retry...')
      expect(console.log).toHaveBeenCalledWith('[meteoalarm] Waiting 2000ms before retry...')
      expect(console.log).not.toHaveBeenCalledWith('[meteoalarm] Waiting 3000ms before retry...')
    })
  })

  describe('clearTokenCache', () => {
    it('forces a new token to be fetched', async () => {
      axios.post
        .mockResolvedValueOnce({ status: 200, data: { token: 'first-token' } })
        .mockResolvedValueOnce({ status: 200, data: { token: 'second-token' } })

      await expect(meteoalarm.getValidToken()).resolves.toBe('first-token')
      meteoalarm.clearTokenCache()
      await expect(meteoalarm.getValidToken()).resolves.toBe('second-token')
      expect(axios.post).toHaveBeenCalledTimes(2)
    })
  })
})
