'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Code = require('code')
const processMessage = require('../lib/functions/processMessage').processMessage
const database = require('../lib/helpers/database')
let data

lab.experiment('home', () => {
  lab.beforeEach((done) => {
    data = require('../config/cap.json')
    // mock database put
    database.put = (params, callback) => {
      callback(null, params)
    }
    done()
  })

  lab.test('Correct data test', (done) => {
    processMessage(data, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.body.Item.id).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
      Code.expect(ret.body.Item.fwisCode).to.equal('064WAF33Hogsmill')
      Code.expect(ret.body.Item.sent).to.equal('2017-05-28T11:00:02-00:00')
      Code.expect(ret.body.Item.expires).to.equal('2017-05-29T11:00:02-00:00')
      Code.expect(ret.body.Item.alert.status[0]).to.equal('Test')
      done()
    })
  })

  lab.test('Correct data test (Production)', (done) => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'
    processMessage(data, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.body.Item.id).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
      Code.expect(ret.body.Item.fwisCode).to.equal('064WAF33Hogsmill')
      Code.expect(ret.body.Item.sent).to.equal('2017-05-28T11:00:02-00:00')
      Code.expect(ret.body.Item.expires).to.equal('2017-05-29T11:00:02-00:00')
      Code.expect(ret.body.Item.alert.status[0]).to.not.equal('Test')
      Code.expect(ret.body.Item.alert.status[0]).to.equal('Actual')
      done()
    })
  })

  lab.test('Bad data test', (done) => {
    // set data to primitive data type
    data = -1
    processMessage(data, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })

  lab.test('Bad data test 2', (done) => {
    // set data to bad xml
    data.bodyXml = '<xml>test</xml'
    processMessage(data, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })

  lab.test('Database error', (done) => {
    database.put = (params, callback) => {
      callback(new Error('unit test error'))
    }
    processMessage(data, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })
})
