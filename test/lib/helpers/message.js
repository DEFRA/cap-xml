'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const { getMessage } = require('../../../lib/helpers/message')
const service = require('../../../lib/helpers/service')
const getMessageXmlInvalid = fs.readFileSync(path.join(__dirname, '..', 'functions', 'data', 'getMessage-invalid.xml'), 'utf8')
const getMessageXmlValid = fs.readFileSync(path.join(__dirname, '..', 'functions', 'data', 'getMessage-valid.xml'), 'utf8')
let event

lab.experiment('getMessage helper', () => {
  lab.beforeEach(() => {
    event = {
      pathParameters: {
        id: '4eb3b7350ab7aa443650fc9351f'
      }
    }
  })

  lab.experiment('getMessage v1 (v2=false)', () => {
    lab.beforeEach(() => {
      // mock service
      service.getMessage = (query, params) => Promise.resolve({
        rows: [{
          getmessage: {
            alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
            alert_v2: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test v2</alert>'
          }
        }]
      })
    })

    lab.test('Returns v1 alert when v2=false', async () => {
      const ret = await getMessage(event, false)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      Code.expect(ret.body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>')
    })

    lab.test('No data found test', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        rows: []
      })

      const err = await Code.expect(getMessage(event, false)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Incorrect database rows object (not array)', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        rows: 1
      })

      const err = await Code.expect(getMessage(event, false)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Incorrect database rows object (empty getmessage)', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        rows: [{}]
      })

      const err = await Code.expect(getMessage(event, false)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Missing database rows object', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        no_rows: []
      })

      const err = await Code.expect(getMessage(event, false)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('No database return', async () => {
      service.getMessage = (query, params) => {
        return new Promise((resolve, reject) => {
          resolve()
        })
      }
      const err = await Code.expect(getMessage(event, false)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Database error', async () => {
      service.getMessage = (query, params) => Promise.reject(new Error('test error'))

      const err = await Code.expect(getMessage(event, false)).to.reject()
      Code.expect(err.message).to.equal('test error')
    })

    lab.test('Event validation test (invalid id property)', async () => {
      event.id = {}
      await Code.expect(getMessage(event, false)).to.reject()
    })

    lab.test('Event validation test (missing pathParameters)', async () => {
      event = {}
      await Code.expect(getMessage(event, false)).to.reject()
    })

    lab.test('Invalid id format test', async () => {
      event.pathParameters.id = 'invalid_id_format'

      await Code.expect(getMessage(event, false)).to.reject()
    })

    lab.test('Valid id format test', async () => {
      event.pathParameters.id = 'a1b2c3'
      const result = await getMessage(event, false)
      const body = result.body

      Code.expect(body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>')
    })

    lab.test('XSD validation logs errors for invalid alert but continues', async () => {
      const consoleLogStub = sinon.stub(console, 'log')
      try {
        service.getMessage = () => Promise.resolve({
          rows: [{
            getmessage: {
              alert: getMessageXmlInvalid
            }
          }]
        })
        await getMessage(event, false)
        Code.expect(consoleLogStub.callCount).to.equal(2)
        Code.expect(consoleLogStub.getCall(0).args[0]).to.equal('CAP get message failed validation')
        Code.expect(consoleLogStub.getCall(1).args[0]).to.equal('[{"rawMessage":"message.xml:19: Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}geocode\': This element is not expected. Expected is ( {urn:oasis:names:tc:emergency:cap:1.2}areaDesc ).","message":"Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}geocode\': This element is not expected. Expected is ( {urn:oasis:names:tc:emergency:cap:1.2}areaDesc ).","loc":{"fileName":"message.xml","lineNumber":19}}]')
      } finally {
        consoleLogStub.restore()
      }
    })

    lab.test('XSD validation does not log for valid alert', async () => {
      const consoleLogStub = sinon.stub(console, 'log')
      try {
        service.getMessage = () => Promise.resolve({
          rows: [{
            getmessage: {
              alert: getMessageXmlValid
            }
          }]
        })
        await getMessage(event, false)
        Code.expect(consoleLogStub.callCount).to.equal(0)
      } finally {
        consoleLogStub.restore()
      }
    })
  })

  lab.experiment('getMessage v2 (v2=true)', () => {
    lab.beforeEach(() => {
      // mock service
      service.getMessage = (query, params) => Promise.resolve({
        rows: [{
          getmessage: {
            alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
            alert_v2: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test v2</alert>'
          }
        }]
      })
    })

    lab.test('Returns v2 alert when v2=true', async () => {
      const ret = await getMessage(event, true)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      Code.expect(ret.body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test v2</alert>')
    })

    lab.test('No data found test', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        rows: []
      })

      const err = await Code.expect(getMessage(event, true)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Incorrect database rows object (not array)', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        rows: 1
      })

      const err = await Code.expect(getMessage(event, true)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Incorrect database rows object (empty getmessage)', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        rows: [{}]
      })

      const err = await Code.expect(getMessage(event, true)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Missing database rows object', async () => {
      service.getMessage = (query, params) => Promise.resolve({
        no_rows: []
      })

      const err = await Code.expect(getMessage(event, true)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('No database return', async () => {
      service.getMessage = (query, params) => {
        return new Promise((resolve, reject) => {
          resolve()
        })
      }
      const err = await Code.expect(getMessage(event, true)).to.reject()
      Code.expect(err.message).to.equal('No message found')
    })

    lab.test('Database error', async () => {
      service.getMessage = (query, params) => Promise.reject(new Error('test error'))

      const err = await Code.expect(getMessage(event, true)).to.reject()
      Code.expect(err.message).to.equal('test error')
    })

    lab.test('Event validation test (invalid id property)', async () => {
      event.id = {}
      await Code.expect(getMessage(event, true)).to.reject()
    })

    lab.test('Event validation test (missing pathParameters)', async () => {
      event = {}
      await Code.expect(getMessage(event, true)).to.reject()
    })

    lab.test('Invalid id format test', async () => {
      event.pathParameters.id = 'invalid_id_format'

      await Code.expect(getMessage(event, true)).to.reject()
    })

    lab.test('Valid id format test', async () => {
      event.pathParameters.id = 'a1b2c3'
      const result = await getMessage(event, true)
      const body = result.body

      Code.expect(body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test v2</alert>')
    })

    lab.test('XSD validation logs errors for invalid alert but continues', async () => {
      const consoleLogStub = sinon.stub(console, 'log')
      try {
        service.getMessage = () => Promise.resolve({
          rows: [{
            getmessage: {
              alert_v2: getMessageXmlInvalid
            }
          }]
        })
        await getMessage(event, true)
        Code.expect(consoleLogStub.callCount).to.equal(2)
        Code.expect(consoleLogStub.getCall(0).args[0]).to.equal('CAP get message failed validation')
        Code.expect(consoleLogStub.getCall(1).args[0]).to.equal('[{"rawMessage":"message.xml:19: Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}geocode\': This element is not expected. Expected is ( {urn:oasis:names:tc:emergency:cap:1.2}areaDesc ).","message":"Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}geocode\': This element is not expected. Expected is ( {urn:oasis:names:tc:emergency:cap:1.2}areaDesc ).","loc":{"fileName":"message.xml","lineNumber":19}}]')
      } finally {
        consoleLogStub.restore()
      }
    })

    lab.test('XSD validation does not log for valid alert', async () => {
      const consoleLogStub = sinon.stub(console, 'log')
      try {
        service.getMessage = () => Promise.resolve({
          rows: [{
            getmessage: {
              alert_v2: getMessageXmlValid
            }
          }]
        })
        await getMessage(event, true)
        Code.expect(consoleLogStub.callCount).to.equal(0)
      } finally {
        consoleLogStub.restore()
      }
    })
  })

  lab.experiment('Edge cases and behavior differences', () => {
    lab.beforeEach(() => {
      service.getMessage = (query, params) => Promise.resolve({
        rows: [{
          getmessage: {
            alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">v1 content</alert>',
            alert_v2: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">v2 content</alert>'
          }
        }]
      })
    })

    lab.test('Returns different content for v1 vs v2', async () => {
      const retV1 = await getMessage(event, false)
      const retV2 = await getMessage(event, true)

      Code.expect(retV1.body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">v1 content</alert>')
      Code.expect(retV2.body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">v2 content</alert>')
      Code.expect(retV1.body).to.not.equal(retV2.body)
    })

    lab.test('Both v1 and v2 return same status code and headers', async () => {
      const retV1 = await getMessage(event, false)
      const retV2 = await getMessage(event, true)

      Code.expect(retV1.statusCode).to.equal(retV2.statusCode)
      Code.expect(retV1.headers).to.equal(retV2.headers)
    })

    lab.test('Logs correct message id when no message found', async () => {
      const consoleLogStub = sinon.stub(console, 'log')
      service.getMessage = () => Promise.resolve({ rows: [] })

      try {
        await getMessage(event, false)
      } catch (err) {
        Code.expect(consoleLogStub.callCount).to.equal(1)
        Code.expect(consoleLogStub.getCall(0).args[0]).to.equal('No message found for 4eb3b7350ab7aa443650fc9351f')
      } finally {
        consoleLogStub.restore()
      }
    })
  })
})
