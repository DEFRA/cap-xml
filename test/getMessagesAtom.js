'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Code = require('code')
const getMessagesAtom = require('../lib/functions/getMessagesAtom').getMessagesAtom
const database = require('../lib/helpers/database')

lab.experiment('getMessagesAtom', () => {
  lab.beforeEach((done) => {
    // mock database query
    database.query = (params, callback) => {
      callback(null, {
        rows: [{
          alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
          sent: new Date(),
          identifier: '4eb3b7350ab7aa443650fc9351f'
        }]
      })
    }
    done()
  })

  lab.test('Correct data test', (done) => {
    getMessagesAtom({}, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      done()
    })
  })

  lab.test('Error test', (done) => {
    database.query = (params, callback) => {
      callback(new Error('test error'))
    }
    getMessagesAtom({}, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })
})
