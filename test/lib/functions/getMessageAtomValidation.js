'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const service = require('../../../lib/helpers/service')
const Proxyquire = require('proxyquire').noCallThru()

// Mock the service.getAllMessages function for validation experiment and tests
const loadHandlerWithValidateMock = (validateMock) => {
  return Proxyquire('../../../lib/helpers/messages', {
    'xmllint-wasm': { validateXML: validateMock }
  }).messages
}

lab.experiment('getMessagesAtom validation logging', () => {
  lab.beforeEach(() => {
    // mock DB
    service.getAllMessages = async () => ({
      rows: [{
        fwis_code: 'test_fwis_code',
        alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
        sent: new Date(),
        identifier: '4eb3b7350ab7aa443650fc9351f'
      }]
    })
  })

  lab.test('logs when validator reports errors and still returns 200', async () => {
    const validateMock = async () => ({
      errors: [{ message: 'bad', line: 12, column: 4 }]
    })
    const getMessagesAtom = loadHandlerWithValidateMock(validateMock)

    // capture console.log
    const logs = []
    const originalLog = console.log
    console.log = (...args) => { logs.push(args.map(a => String(a)).join(' ')) }

    try {
      const ret = await getMessagesAtom({})
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      // Check for validation error logs with new prefix format
      Code.expect(logs.some(l => l.includes('[getMessagesAtom] ATOM feed failed validation'))).to.equal(true)
      Code.expect(logs.some(l => l.includes('[getMessagesAtom] Validation errors:'))).to.equal(true)
      Code.expect(logs.some(l => l.includes(JSON.stringify([{ message: 'bad', line: 12, column: 4 }])))).to.equal(true)
    } finally {
      console.log = originalLog
    }
  })

  lab.test('does not log when validator returns no errors', async () => {
    const validateMock = async () => ({ errors: [] })
    const getMessagesAtom = loadHandlerWithValidateMock(validateMock)

    const logs = []
    const originalLog = console.log
    console.log = (msg) => { logs.push(String(msg)) }

    try {
      const ret = await getMessagesAtom({})
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(logs.some(l => l.includes('failed validation'))).to.equal(false)
    } finally {
      console.log = originalLog
    }
  })
})
