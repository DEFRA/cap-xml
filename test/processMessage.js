'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const Code = require('code')
const processMessage = require('../lib/functions/processMessage').processMessage
const service = require('../lib/helpers/service')
const moment = require('moment')
let capAlert
let capUpdate

const tomorrow = new Date(new Date().getTime() + (24 * 60 * 60 * 1000))
const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000))

lab.experiment('processMessage', () => {
  lab.beforeEach(() => {
    capAlert = require('./data/capAlert.json')
    capUpdate = require('./data/capUpdate.json')

    // mock services
    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        resolve()
      })
    }
    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            id: '51',
            identifier: '4eb3b7350ab7aa443650fc9351f2'
          }]
        })
      })
    }
  })

  lab.test('Correct data test with no previous alert on test', async () => {
    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: []
        })
      })
    }
    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        Code.expect(query.values[2]).to.be.empty()
        Code.expect(query.values[1]).to.equal('Alert')
        resolve()
      })
    }
    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.equal('Test')
  })

  lab.test('Correct data test with no previous alert on test 2', async () => {
    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve()
      })
    }
    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        Code.expect(query.values[2]).to.be.empty()
        Code.expect(query.values[1]).to.equal('Alert')
        resolve()
      })
    }
    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.equal('Test')
  })

  lab.test('Correct data test with no previous alert on production', async () => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'

    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        // Check that reference field is blank
        Code.expect(query.values[2]).to.be.empty()
        Code.expect(query.values[1]).to.equal('Alert')
        resolve()
      })
    }

    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.not.equal('Test')
    Code.expect(ret.body.status).to.equal('Actual')
  })

  lab.test('Correct data test with active alert on test', async () => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'

    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            id: '51',
            identifier: '4eb3b7350ab7aa443650fc9351f2',
            expires: tomorrow,
            sent: yesterday
          }]
        })
      })
    }

    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        Code.expect(query.values[2]).to.not.be.empty()
        Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
        Code.expect(query.values[1]).to.equal('Update')
        resolve()
      })
    }

    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.not.equal('Test')
    Code.expect(ret.body.status).to.equal('Actual')
  })

  lab.test('Correct data test with active alert on test with prexisting references field', async () => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'

    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            id: '51',
            identifier: '4eb3b7350ab7aa443650fc9351f2',
            expires: tomorrow,
            sent: yesterday,
            references: yesterday.toISOString()
          }]
        })
      })
    }

    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        Code.expect(query.values[2]).to.not.be.empty()
        Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
        Code.expect(query.values[1]).to.equal('Update')
        resolve()
      })
    }

    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.not.equal('Test')
    Code.expect(ret.body.status).to.equal('Actual')
  })

  lab.test('Correct alert data test with an active on production', async () => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'
    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            id: '51',
            identifier: '4eb3b7350ab7aa443650fc9351f2',
            sent: yesterday,
            expires: tomorrow,
            msgType: 'Alert'
          }]
        })
      })
    }

    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        Code.expect(query.values[2]).to.not.be.empty()
        Code.expect(query.values[1]).to.equal('Update')
        Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
        resolve()
      })
    }

    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.not.equal('Test')
    Code.expect(ret.body.status).to.equal('Actual')
  })

  lab.test('Correct update data test with an active on production', async () => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'

    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            id: '51',
            identifier: '4eb3b7350ab7aa443650fc9351f2',
            sent: yesterday,
            expires: tomorrow,
            msgType: 'Alert'
          }]
        })
      })
    }

    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        Code.expect(query.values[2]).to.not.be.empty()
        Code.expect(query.values[1]).to.equal('Update')
        Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
        resolve()
      })
    }

    const ret = await processMessage(capUpdate)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.not.equal('Test')
    Code.expect(ret.body.status).to.equal('Actual')
  })

  lab.test('Bad data test', async () => {
    await Code.expect(processMessage(1)).to.reject()
  })

  lab.test('Bad data test 2', async () => {
    await Code.expect(processMessage({bodyXml: '$%^&*'})).to.reject()
  })

  lab.test('Database error', async () => {
    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        reject(new Error('unit test error'))
      })
    }
    const err = await Code.expect(processMessage(capAlert)).to.reject()
    Code.expect(err.message).to.equal('unit test error')
   })

  lab.test('Database error 2', async () => {
    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        reject(new Error('unit test error'))
      })
    }
    const err = await Code.expect(processMessage(capAlert)).to.reject()
    Code.expect(err.message).to.equal('unit test error')
  })

  lab.test('Correct data test for processMessage where previous message is active and has reference', async () => {
    const config = require('../config/config.json')
    config.aws.stage = 'ea'

    service.getLastMessage = (id) => {
      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            id: '51',
            identifier: '4eb3b7350ab7aa443650fc9351f2',
            expires: tomorrow,
            sent: yesterday,
            references: 'Previous_Active_Message'
          }]
        })
      })
    }

    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        const lastDate = moment(yesterday).utc().format('YYYY-MM-DDTHH:mm:ssZ')
        Code.expect(query.values[2]).to.not.be.empty()
        Code.expect(query.values[1]).to.equal('Update')
        Code.expect(query.values[2]).to.contain(`Previous_Active_Message www.gov.uk/environment-agency,4eb3b7350ab7aa443650fc9351f2,${lastDate}`)
        Code.expect(query.values[2]).to.not.contain('00:00+00:00')
        resolve()
      })
    }

    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.not.equal('Test')
    Code.expect(ret.body.status).to.equal('Actual')
  })
})
