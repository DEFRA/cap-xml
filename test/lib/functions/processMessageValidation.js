'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const Proxyquire = require('proxyquire').noCallThru()
const capAlert = require('./data/capAlert.json')

const fakeService = {
  getLastMessage: async () => ({ rows: [] }),
  putMessage: async () => {}
}
const FakeMessage = function () {
  this.data = {
    alert: '<alert>test</alert>',
    identifier: 'id123',
    fwis_code: 'FWC',
    sent: '2020-01-01T00:00:00Z',
    expires: '2020-01-02T00:00:00Z'
  }
  this.putQuery = {}
}
const fakeSchema = { validate: () => ({ error: null }) }
const fakeAws = { email: { publishMessage: async () => {} } }

const loadWithValidateMock = (validateMock) => {
  return Proxyquire('../../../lib/functions/processMessage', {
    'xmllint-wasm': { validateXML: validateMock },
    '../helpers/service': fakeService,
    '../models/message': FakeMessage,
    '../schemas/processMessageEventSchema': fakeSchema,
    '../helpers/aws': fakeAws
  }).processMessage
}

lab.experiment('processMessage validation logging', () => {
  lab.test('logs when pre/post validation has errors', async () => {
    const validateMock = async () => ({ errors: [{ message: 'oops' }] })
    const processMessage = loadWithValidateMock(validateMock)

    const logs = []
    const origLog = console.log
    console.log = (msg) => logs.push(String(msg))

    try {
      await processMessage({ bodyXml: capAlert.bodyXml })
      Code.expect(logs).to.include('CAP message failed validation: pre processing')
      Code.expect(logs).to.include('CAP message failed validation: post processing')
    } finally {
      console.log = origLog
    }
  })

  lab.test('does not log when validator has no errors', async () => {
    const validateMock = async () => ({ errors: [] })
    const processMessage = loadWithValidateMock(validateMock)

    const logs = []
    const origLog = console.log
    console.log = (msg) => logs.push(String(msg))

    try {
      await processMessage({ bodyXml: capAlert.bodyXml })
      Code.expect(logs.some(l => l.includes('failed validation'))).to.be.false()
    } finally {
      console.log = origLog
    }
  })
})
