'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Code = require('code')
const getMessage = require('../lib/functions/getMessage').getMessage
const service = require('../lib/helpers/service')
let event

lab.experiment('getMessage', () => {
  lab.beforeEach(() => {
    event = {
      pathParameters: {
        id: '4eb3b7350ab7aa443650fc9351f'
      }
    }
    // mock service
    service.getMessage = (query, params) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            getmessage: {
              alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>'
            }
          }]
        })
      })
    }
  })

  lab.test('Correct data test', async () => {
    const ret = await getMessage(event)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.headers['content-type']).to.equal('application/xml')
    Code.expect(ret.body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>')
  })

  lab.test('No data found test', async () => {
    service.getMessage = (query, params) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: []
        })
      })
    }
    try {
      await getMessage(event)
      Code.expect(true).to.equal(false)
    } catch (err) {
      Code.expect(err.message).to.equal('No message found')
    }
  })

  lab.test('Incorrect database rows object', async () => {
    service.getMessage = (query, params) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: 1
        })
      })
    }
    try {
      await getMessage(event)
      Code.expect(true).to.equal(false)
    } catch (err) {
      Code.expect(err.message).to.equal('No message found')
    }
  })

  lab.test('Incorrect database rows object', async () => {
    service.getMessage = (query, params) => {
      return new Promise((resolve, reject) => {
        resolve({})
      })
    }
    try {
      await getMessage(event)
      Code.expect(true).to.equal(false)
    } catch (err) {
      Code.expect(err.message).to.equal('No message found')
    }
  })

  lab.test('No database return', async () => {
    service.getMessage = (query, params) => {
      return new Promise((resolve, reject) => {
        resolve()
      })
    }
    try {
      await getMessage(event)
      Code.expect(true).to.equal(false)
    } catch (err) {
      Code.expect(err.message).to.equal('No message found')
    }
  })

  lab.test('Error test', async () => {
    service.getMessage = (query, params) => {
      return new Promise((resolve, reject) => {
        reject(new Error('test error'))
      })
    }
    try {
      await getMessage(event)
      Code.expect(true).to.equal(false)
    } catch (err) {
      Code.expect(err.message).to.equal('test error')
    }
  })

  lab.test('event validation test', async () => {
    event.id = {}
    try {
      await getMessage(event)
      Code.expect(true).to.equal(false)
    } catch (err) {
      Code.expect(err).to.be.an.error()
    }
  })

  lab.test('event validation test 2', async () => {
    event = {}
    try {
      await getMessage(event)
      Code.expect(true).to.equal(false)
    } catch (err) {
      Code.expect(err).to.be.an.error()
    }
  })
})
