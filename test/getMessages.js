'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Code = require('code')
const getMessages = require('../lib/functions/getMessages').getMessages
const database = require('../lib/helpers/database')
let capAlert

lab.experiment('getMessages', () => {
  lab.beforeEach((done) => {
    capAlert = require('./data/capAlert.json')
    // mock database query
    database.query = (params, callback) => {
      callback(null, {
        rows: [{
          alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>'
        }]
      })
    }
    done()
  })

  lab.test('Correct data test', (done) => {
    getMessages(capAlert, {}, (err, ret) => {
      console.log(ret)
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      Code.expect(ret.body).to.equal('<?xml version="1.0" standalone="yes"?>\n<messages>\n<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>\n</messages>')
      done()
    })
  })
})
