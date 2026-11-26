'use strict'

jest.mock('../../../lib/helpers/messages', () => ({ messages: jest.fn() }))

const messagesHelper = require('../../../lib/helpers/messages')
const { getMessagesAtom } = require('../../../lib/functions/getMessagesAtom')

describe('getMessagesAtom v1 wrapper', () => {
  it('calls the messages helper with v2=false', async () => {
    messagesHelper.messages.mockResolvedValue({})

    await getMessagesAtom()

    expect(messagesHelper.messages).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('returns the result from the messages helper', async () => {
    const expectedResult = {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<feed>v1 feed</feed>'
    }
    messagesHelper.messages.mockResolvedValue(expectedResult)

    await expect(getMessagesAtom()).resolves.toEqual(expectedResult)
  })
})
