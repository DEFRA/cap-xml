'use strict'

jest.mock('../../../lib/helpers/message', () => ({ getMessage: jest.fn() }))

const messageHelper = require('../../../lib/helpers/message')
const { getMessage } = require('../../../lib/functions/getMessage')

describe('getMessage v1 wrapper', () => {
  const event = { pathParameters: { id: 'test123' } }

  it('calls the getMessage helper with v2=false', async () => {
    messageHelper.getMessage.mockResolvedValue({})

    await getMessage(event)

    expect(messageHelper.getMessage).toHaveBeenCalledExactlyOnceWith(event, false)
  })

  it('returns the result from the getMessage helper', async () => {
    const expectedResult = {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<alert>v1 alert</alert>'
    }
    messageHelper.getMessage.mockResolvedValue(expectedResult)

    await expect(getMessage(event)).resolves.toEqual(expectedResult)
  })
})
