'use strict'

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const sinon = require('sinon')
const Proxyquire = require('proxyquire')

const lab = exports.lab = Lab.script()

const ORIGINAL_ENV = process.env

lab.experiment('meteoalarm helper', () => {
  let meteoalarm
  let axiosStub

  lab.beforeEach(() => {
    // Mock environment - must be set before loading module
    process.env = { ...ORIGINAL_ENV }
    process.env.CPX_METEOALARM_API_URL = 'https://test-meteoalarm.example.com'
    process.env.CPX_METEOALARM_API_USERNAME = 'test-user'
    process.env.CPX_METEOALARM_API_PASSWORD = 'test-password'

    // Create axios stub
    axiosStub = {
      post: sinon.stub()
    }

    // Clear the require cache to force fresh module load
    delete require.cache[require.resolve('../../../lib/helpers/meteoalarm')]

    // Load module with mocked axios
    meteoalarm = Proxyquire('../../../lib/helpers/meteoalarm', {
      axios: axiosStub
    })

    // Clear any cached token before each test
    meteoalarm.clearTokenCache()
  })

  lab.afterEach(() => {
    sinon.restore()
    process.env = ORIGINAL_ENV
  })

  lab.experiment('getValidToken', () => {
    lab.test('fetches a new token successfully', async () => {
      axiosStub.post.resolves({
        status: 200,
        data: { token: 'test-bearer-token-123' }
      })

      const token = await meteoalarm.getValidToken()

      Code.expect(token).to.equal('test-bearer-token-123')
      Code.expect(axiosStub.post.calledOnce).to.be.true()
      Code.expect(axiosStub.post.firstCall.args[0]).to.equal('https://test-meteoalarm.example.com/tokens')
      Code.expect(axiosStub.post.firstCall.args[1]).to.equal({
        username: 'test-user',
        password: 'test-password'
      })
      Code.expect(axiosStub.post.firstCall.args[2].headers['Content-Type']).to.equal('application/json')
    })

    lab.test('returns cached token if still valid', async () => {
      // First call to get token
      axiosStub.post.resolves({
        status: 200,
        data: { token: 'cached-token' }
      })

      const token1 = await meteoalarm.getValidToken()
      Code.expect(token1).to.equal('cached-token')
      Code.expect(axiosStub.post.calledOnce).to.be.true()

      // Second call should return cached token without making another API call
      const token2 = await meteoalarm.getValidToken()
      Code.expect(token2).to.equal('cached-token')
      Code.expect(axiosStub.post.calledOnce).to.be.true() // Still only called once
    })

    lab.test('throws error when authentication fails with non-200 status', async () => {
      axiosStub.post.resolves({
        status: 401,
        statusText: 'Unauthorized'
      })

      await Code.expect(meteoalarm.getValidToken()).to.reject(Error, 'Failed to authenticate with Meteoalarm: Failed to authenticate: 401 Unauthorized')
    })

    lab.test('throws error when axios request fails', async () => {
      axiosStub.post.rejects(new Error('Network error'))

      await Code.expect(meteoalarm.getValidToken()).to.reject(Error, 'Failed to authenticate with Meteoalarm: Network error')
    })
  })

  lab.experiment('postWarning', () => {
    lab.beforeEach(() => {
      // Set a very short retry delay for testing (10ms instead of 1000ms)
      meteoalarm.setRetryDelayMultiplier(10)
    })

    lab.afterEach(() => {
      // Reset to default
      meteoalarm.setRetryDelayMultiplier(1000)
    })

    lab.test('successfully posts warning on first attempt', async () => {
      const xmlMessage = '<alert><identifier>test-id</identifier></alert>'
      const identifier = 'test-id'

      // Mock token request
      axiosStub.post.onFirstCall().resolves({
        status: 200,
        data: { token: 'test-token' }
      })

      // Mock warning post
      axiosStub.post.onSecondCall().resolves({
        status: 201,
        data: { id: 'warning-123', status: 'created' }
      })

      const result = await meteoalarm.postWarning(xmlMessage, identifier)

      Code.expect(result).to.equal({ id: 'warning-123', status: 'created' })
      Code.expect(axiosStub.post.calledTwice).to.be.true()

      // Verify warning post call
      const warningCall = axiosStub.post.secondCall
      Code.expect(warningCall.args[0]).to.equal('https://test-meteoalarm.example.com/warnings')
      Code.expect(warningCall.args[1]).to.equal(xmlMessage)
      Code.expect(warningCall.args[2].headers.Authorization).to.equal('Bearer test-token')
      Code.expect(warningCall.args[2].headers['Content-Type']).to.equal('application/xml')
      Code.expect(warningCall.args[2].timeout).to.equal(10000)
    })

    lab.test('retries on failure and succeeds on second attempt', async () => {
      const xmlMessage = '<alert><identifier>test-id</identifier></alert>'
      const identifier = 'test-id'

      // Mock token request using withArgs for better matching
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/tokens').resolves({
        status: 200,
        data: { token: 'test-token' }
      })

      // Track warning post attempts
      let attemptCount = 0
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/warnings').callsFake(() => {
        attemptCount++
        if (attemptCount === 1) {
          const error = new Error('Timeout')
          error.response = { data: { error: 'timeout' } }
          return Promise.reject(error)
        } else {
          return Promise.resolve({
            status: 201,
            data: { id: 'warning-123' }
          })
        }
      })

      const result = await meteoalarm.postWarning(xmlMessage, identifier)

      Code.expect(result).to.equal({ id: 'warning-123' })
      Code.expect(attemptCount).to.equal(2)
    })

    lab.test('clears cached token on 401 and retries', async () => {
      const xmlMessage = '<alert><identifier>test-id</identifier></alert>'
      const identifier = 'test-id'

      // Track token requests
      let tokenRequestCount = 0
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/tokens').callsFake(() => {
        tokenRequestCount++
        return Promise.resolve({
          status: 200,
          data: { token: tokenRequestCount === 1 ? 'expired-token' : 'fresh-token' }
        })
      })

      // Track warning post attempts
      let warningAttemptCount = 0
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/warnings').callsFake(() => {
        warningAttemptCount++
        if (warningAttemptCount === 1) {
          const error = new Error('Unauthorized')
          error.response = { status: 401, data: { error: 'token expired' } }
          return Promise.reject(error)
        } else {
          return Promise.resolve({
            status: 201,
            data: { id: 'warning-456' }
          })
        }
      })

      const result = await meteoalarm.postWarning(xmlMessage, identifier)

      Code.expect(result).to.equal({ id: 'warning-456' })
      // Should have fetched token twice because of 401
      Code.expect(tokenRequestCount).to.equal(2)
    })

    lab.test('throws error after max retries exceeded', async () => {
      const xmlMessage = '<alert><identifier>test-id</identifier></alert>'
      const identifier = 'test-id'

      // Mock token request
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/tokens').resolves({
        status: 200,
        data: { token: 'test-token' }
      })

      // All warning posts fail
      const error = new Error('Service unavailable')
      error.response = { data: { error: 'service down' } }
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/warnings').rejects(error)

      await Code.expect(meteoalarm.postWarning(xmlMessage, identifier)).to.reject(Error, 'Failed to post warning to Meteoalarm after 3 attempts: Service unavailable')
    })

    lab.test('throws error when non-201 status is received', async () => {
      const xmlMessage = '<alert><identifier>test-id</identifier></alert>'
      const identifier = 'test-id'

      // Mock token request
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/tokens').resolves({
        status: 200,
        data: { token: 'test-token' }
      })

      // Warning post returns non-201 status and will retry
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/warnings').resolves({
        status: 200,
        data: { message: 'accepted but not created' }
      })

      await Code.expect(meteoalarm.postWarning(xmlMessage, identifier)).to.reject(Error, 'Failed to post warning to Meteoalarm after 3 attempts: Received non-201 response: 200')
    })

    lab.test('handles error without response object', async () => {
      const xmlMessage = '<alert><identifier>test-id</identifier></alert>'
      const identifier = 'test-id'

      // Mock token request
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/tokens').resolves({
        status: 200,
        data: { token: 'test-token' }
      })

      // All warning posts fail without response object
      axiosStub.post.withArgs('https://test-meteoalarm.example.com/warnings').rejects(new Error('Network error'))

      await Code.expect(meteoalarm.postWarning(xmlMessage, identifier)).to.reject(Error, 'Failed to post warning to Meteoalarm after 3 attempts: Network error')
    })
  })

  lab.experiment('clearTokenCache', () => {
    lab.test('clears cached token requiring new fetch', async () => {
      // First call to get token
      axiosStub.post.resolves({
        status: 200,
        data: { token: 'first-token' }
      })

      const token1 = await meteoalarm.getValidToken()
      Code.expect(token1).to.equal('first-token')
      Code.expect(axiosStub.post.calledOnce).to.be.true()

      // Clear the cache
      meteoalarm.clearTokenCache()

      // Mock a different token for next call
      axiosStub.post.resolves({
        status: 200,
        data: { token: 'second-token' }
      })

      // Next call should fetch a new token
      const token2 = await meteoalarm.getValidToken()
      Code.expect(token2).to.equal('second-token')
      Code.expect(axiosStub.post.calledTwice).to.be.true()
    })
  })

  lab.experiment('integration scenarios', () => {
    lab.test('uses cached token across multiple warning posts', async () => {
      const xmlMessage1 = '<alert><identifier>test-id-1</identifier></alert>'
      const xmlMessage2 = '<alert><identifier>test-id-2</identifier></alert>'

      // Mock token request once - should only be called once
      let tokenCallCount = 0
      axiosStub.post.callsFake((url, data, config) => {
        if (url.includes('/tokens')) {
          tokenCallCount++
          return Promise.resolve({
            status: 200,
            data: { token: 'shared-token' }
          })
        } else if (url.includes('/warnings')) {
          // Return different results for different messages
          if (data === xmlMessage1) {
            return Promise.resolve({
              status: 201,
              data: { id: 'warning-1' }
            })
          } else if (data === xmlMessage2) {
            return Promise.resolve({
              status: 201,
              data: { id: 'warning-2' }
            })
          }
        }
        return Promise.reject(new Error('Unexpected call'))
      })

      await meteoalarm.postWarning(xmlMessage1, 'test-id-1')
      await meteoalarm.postWarning(xmlMessage2, 'test-id-2')

      // Token should only be fetched once
      Code.expect(tokenCallCount).to.equal(1)
    })
  })
})
