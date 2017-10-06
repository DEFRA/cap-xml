'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Code = require('code')
const getMessage = require('../lib/functions/getMessage').getMessage
const database = require('../lib/helpers/database')
let event

lab.experiment('getMessage', () => {
  lab.beforeEach((done) => {
    event = {
      pathParameters: {
        id: '4eb3b7350ab7aa443650fc9351f'
      }
    }
    // mock database query
    database.queryVars = (query, params, callback) => {
      callback(null, {
        rows: [{
          alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>'
        }]
      })
    }
    done()
  })

  lab.test('Correct data test', (done) => {
    getMessage(event, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      Code.expect(ret.body).to.equal('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>')
      done()
    })
  })

  lab.test('No data found test', (done) => {
    database.queryVars = (query, params, callback) => {
      callback(null, {
        rows: []
      })
    }
    getMessage(event, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.body).to.be.undefined()
      done()
    })
  })

  lab.test('Error test', (done) => {
    database.queryVars = (query, params, callback) => {
      callback(new Error('test error'))
    }
    getMessage(event, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })

  lab.test('event validation test', (done) => {
    event.id = {}
    getMessage(event, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })
  lab.test('event validation test 2', (done) => {
    event = {}
    getMessage(event, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })
})
