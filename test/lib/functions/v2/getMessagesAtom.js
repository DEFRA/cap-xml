'use strict'

jest.mock('../../../../lib/helpers/messages', () => ({ messages: jest.fn() }))

const messagesHelper = require('../../../../lib/helpers/messages')
const { getMessagesAtom } = require('../../../../lib/functions/v2/getMessagesAtom')

describe('getMessagesAtom v2 wrapper', () => {
  it('calls the messages helper with v2=true', async () => {
    messagesHelper.messages.mockResolvedValue({})

    await getMessagesAtom()

    expect(messagesHelper.messages).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('returns the result from the messages helper', async () => {
    const expectedResult = {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<feed>v2 feed</feed>'
    }
    messagesHelper.messages.mockResolvedValue(expectedResult)

    await expect(getMessagesAtom()).resolves.toEqual(expectedResult)
  })
})
