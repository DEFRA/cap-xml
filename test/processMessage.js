'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Code = require('code')
const processMessage = require('../lib/functions/processMessage').processMessage
const database = require('../lib/helpers/database')
let capAlert
let capUpdate

lab.experiment('processMessage', () => {
  lab.beforeEach((done) => {
    capAlert = require('./data/capAlert.json')
    capUpdate = require('./data/capUpdate.json')
    // mock database query
    database.query = (params, callback) => {
      callback(null, params)
    }
    database.queryVars = (params, vars, callback) => {
      callback(null, {
        rows: [{
          id: '51',
          identifier: '4eb3b7350ab7aa443650fc9351f2'
        }]
      })
    }
    done()
  })

  lab.test('Correct data test with no previous alert on test', (done) => {
    database.queryVars = (params, vars, callback) => {
      callback(null, {
        rows: []
      })
    }
    processMessage(capAlert, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
      Code.expect(ret.body.fwisCode).to.equal('064WAF33Hogsmill')
      Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
      Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
      Code.expect(ret.body.status).to.equal('Test')
      done()
    })
  })

  lab.test('Correct data test with no previous alert on production', (done) => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'
    processMessage(capAlert, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
      Code.expect(ret.body.fwisCode).to.equal('064WAF33Hogsmill')
      Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
      Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
      Code.expect(ret.body.status).to.not.equal('Test')
      Code.expect(ret.body.status).to.equal('Actual')
      done()
    })
  })

  lab.test('Correct data test with active alert on test', (done) => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'
    database.queryVars = (params, vars, callback) => {
      callback(null, {
        rows: [{
          id: '51',
          identifier: '4eb3b7350ab7aa443650fc9351f2'
        }]
      })
    }
    processMessage(capAlert, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
      Code.expect(ret.body.fwisCode).to.equal('064WAF33Hogsmill')
      Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
      Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
      Code.expect(ret.body.status).to.not.equal('Test')
      Code.expect(ret.body.status).to.equal('Actual')
      done()
    })
  })

  lab.test('Correct alert data test with an active on production', (done) => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'
    let tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    database.queryVars = (params, vars, callback) => {
      callback(null, {
        rows: [{
          id: '51',
          identifier: '4eb3b7350ab7aa443650fc9351f2',
          sent: new Date(),
          expires: tomorrow,
          msgType: 'Alert'
        }]
      })
    }
    processMessage(capAlert, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
      Code.expect(ret.body.fwisCode).to.equal('064WAF33Hogsmill')
      Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
      Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
      Code.expect(ret.body.status).to.not.equal('Test')
      Code.expect(ret.body.status).to.equal('Actual')
      done()
    })
  })

  lab.test('Correct update data test with an active on production', (done) => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'
    let tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    database.queryVars = (params, vars, callback) => {
      callback(null, {
        rows: [{
          id: '51',
          identifier: '4eb3b7350ab7aa443650fc9351f2',
          sent: new Date(),
          expires: tomorrow,
          references: 'test',
          msgType: 'Alert'
        }]
      })
    }

    processMessage(capUpdate, {}, (err, ret) => {
      Code.expect(err).to.be.null()
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
      Code.expect(ret.body.fwisCode).to.equal('064WAF33Hogsmill')
      Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
      Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
      Code.expect(ret.body.status).to.not.equal('Test')
      Code.expect(ret.body.status).to.equal('Actual')
      done()
    })
  })

  lab.test('Bad data test', (done) => {
    // set data to primitive data type
    processMessage(1, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })

  lab.test('Bad data test 2', (done) => {
    // set data to bad xml
    processMessage({bodyXml: '$%^&*'}, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })

  lab.test('Database error', (done) => {
    database.query = (params, callback) => {
      callback(new Error('unit test error'))
    }
    processMessage(capAlert, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })
  lab.test('Database error 2', (done) => {
    database.queryVars = (params, vars, callback) => {
      callback(new Error('unit test error'))
    }
    processMessage(capAlert, {}, (err, ret) => {
      Code.expect(err).to.be.an.error()
      Code.expect(ret).to.be.undefined()
      done()
    })
  })
})
