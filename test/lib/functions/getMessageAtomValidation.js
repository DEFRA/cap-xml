'use strict'

jest.mock('xmllint-wasm', () => ({ validateXML: jest.fn() }))

const { validateXML } = require('xmllint-wasm')
const { messages } = require('../../../lib/helpers/messages')
const service = require('../../../lib/helpers/service')

const ORIGINAL_ENV = process.env

describe('getMessagesAtom validation logging', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, CPX_AGW_URL: 'http://localhost:3000' }
    jest.spyOn(service, 'getAllMessages').mockResolvedValue({
      rows: [{
        fwis_code: 'test_fwis_code',
        alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
        sent: new Date(),
        identifier: '4eb3b7350ab7aa443650fc9351f'
      }]
    })
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('logs when the validator reports errors and still returns 200', async () => {
    const errors = [{ message: 'bad', line: 12, column: 4 }]
    validateXML.mockResolvedValue({ errors })

    const ret = await messages()

    expect(ret.statusCode).toBe(200)
    expect(ret.headers['content-type']).toBe('application/xml')
    expect(console.log).toHaveBeenCalledWith('[getMessagesAtom] ATOM feed failed validation')
    expect(console.log).toHaveBeenCalledWith('[getMessagesAtom] Validation errors:', JSON.stringify(errors))
  })

  it.each([
    ['an empty errors array', { errors: [] }],
    ['no errors property', {}]
  ])('does not log when the validator returns %s', async (_description, result) => {
    validateXML.mockResolvedValue(result)

    const ret = await messages()

    expect(ret.statusCode).toBe(200)
    expect(console.log).not.toHaveBeenCalledWith('[getMessagesAtom] ATOM feed failed validation')
  })
})
