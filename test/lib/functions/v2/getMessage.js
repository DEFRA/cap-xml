'use strict'

jest.mock('../../../../lib/helpers/message', () => ({ getMessage: jest.fn() }))

const messageHelper = require('../../../../lib/helpers/message')
const { getMessage } = require('../../../../lib/functions/v2/getMessage')

describe('getMessage v2 wrapper', () => {
  const event = { pathParameters: { id: 'test123' } }

  it('calls the getMessage helper with v2=true', async () => {
    messageHelper.getMessage.mockResolvedValue({})

    await getMessage(event)

    expect(messageHelper.getMessage).toHaveBeenCalledExactlyOnceWith(event, true)
  })

  it('returns the result from the getMessage helper', async () => {
    const expectedResult = {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<alert>v2 alert</alert>'
    }
    messageHelper.getMessage.mockResolvedValue(expectedResult)

    await expect(getMessage(event)).resolves.toEqual(expectedResult)
  })
})
