'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const getMessage = require('../../../lib/functions/getMessage').getMessage
const service = require('../../../lib/helpers/service')

let event

lab.experiment('getMessage', () => {
  lab.beforeEach(() => {
    event = {
      pathParameters: {
        id: '4eb3b7350ab7aa443650fc9351f'
      }
    }
    // mock service
    service.getMessage = (query, params) => Promise.resolve({
      rows: [{
        getmessage: {
          alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>'
        }
      }]
    })
  })

  lab.test('Correct data test', async () => {
    const ret = await getMessage(event)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.headers['content-type']).to.equal('application/xml')
    Code.expect(ret.body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>')
  })

  lab.test('No data found test', async () => {
    service.getMessage = (query, params) => Promise.resolve({
      rows: []
    })

    const err = await Code.expect(getMessage(event)).to.reject()
    Code.expect(err.message).to.equal('No message found')
  })

  lab.test('Incorrect database rows object', async () => {
    service.getMessage = (query, params) => Promise.resolve({
      rows: 1
    })

    const err = await Code.expect(getMessage(event)).to.reject()
    Code.expect(err.message).to.equal('No message found')
  })

  lab.test('Incorrect database rows object', async () => {
    service.getMessage = (query, params) => Promise.resolve({
      rows: [{}]
    })

    const err = await Code.expect(getMessage(event)).to.reject()
    Code.expect(err.message).to.equal('No message found')
  })

  lab.test('Missing database rows object', async () => {
    service.getMessage = (query, params) => Promise.resolve({
      no_rows: []
    })

    const err = await Code.expect(getMessage(event)).to.reject()
    Code.expect(err.message).to.equal('No message found')
  })

  lab.test('No database return', async () => {
    service.getMessage = (query, params) => {
      return new Promise((resolve, reject) => {
        resolve()
      })
    }
    const err = await Code.expect(getMessage(event)).to.reject()
    Code.expect(err.message).to.equal('No message found')
  })

  lab.test('Error test', async () => {
    service.getMessage = (query, params) => Promise.reject(new Error('test error'))

    const err = await Code.expect(getMessage(event)).to.reject()
    Code.expect(err.message).to.equal('test error')
  })

  lab.test('event validation test', async () => {
    event.id = {}
    await Code.expect(getMessage(event)).to.reject()
  })

  lab.test('event validation test 2', async () => {
    event = {}
    await Code.expect(getMessage(event)).to.reject()
  })
  lab.test('Invalid id format test', async () => {
    event.pathParameters.id = 'invalid_id_format'

    await Code.expect(getMessage(event)).to.reject()
  })
  lab.test('Valid id format test', async () => {
    event.pathParameters.id = 'a1b2c3'
    const result = await getMessage(event)
    const body = result.body

    Code.expect(body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>')
  })
})
