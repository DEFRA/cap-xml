'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const getMessagesAtom = require('../../../lib/functions/getMessagesAtom').getMessagesAtom
const service = require('../../../lib/helpers/service')

lab.experiment('getMessagesAtom', () => {
  lab.beforeEach(() => {
    // mock database query
    service.getAllMessages = (query) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            fwis_code: 'test_fwis_code',
            alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
            sent: new Date(),
            identifier: '4eb3b7350ab7aa443650fc9351f'
          }]
        })
      })
    }
  })

  lab.test('Correct data test', async () => {
    const ret = await getMessagesAtom({})
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.headers['content-type']).to.equal('application/xml')
  })

  lab.test('Bad rows returned', async () => {
    service.getAllMessages = (query) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: 1
        })
      })
    }
    const ret = await getMessagesAtom({})
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.headers['content-type']).to.equal('application/xml')
  })

  lab.test('No return from database', async () => {
    service.getAllMessages = (query) => {
      return new Promise((resolve, reject) => {
        resolve()
      })
    }
    const ret = await getMessagesAtom({})
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.headers['content-type']).to.equal('application/xml')
  })

  lab.test('Error test', async () => {
    service.getAllMessages = (query) => {
      return new Promise((resolve, reject) => {
        reject(new Error('test error'))
      })
    }
    const err = await Code.expect(getMessagesAtom({})).to.reject()
    Code.expect(err.message).to.equal('test error')
  })
})
