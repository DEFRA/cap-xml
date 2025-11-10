'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const processMessage = require('../../../lib/functions/processMessage').processMessage
const service = require('../../../lib/helpers/service')
const aws = require('../../../lib/helpers/aws')
const moment = require('moment')
let capAlert
let capUpdate

const ORIGINAL_ENV = process.env

const tomorrow = new Date(new Date().getTime() + (24 * 60 * 60 * 1000))
const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000))

lab.experiment('processMessage', () => {
  lab.beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    capAlert = require('./data/capAlert.json')
    capUpdate = require('./data/capUpdate.json')

    // mock services
    service.putMessage = (query) => {
      return new Promise((resolve, reject) => {
        resolve()
      })
    }
    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2'
      }]
    })
  })

  lab.afterEach(() => {
    sinon.restore()
  })

  lab.test('Correct data test with no previous alert on test', async () => {
    service.getLastMessage = (id) => Promise.resolve({
      rows: []
    })

    service.putMessage = (query) => Promise.resolve().then(() => {
      Code.expect(query.values[2]).to.be.empty()
      Code.expect(query.values[1]).to.equal('Alert')
    })

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
    process.env.stage = 'prd'

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
    process.env.stage = 'prd'

    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        expires: tomorrow,
        sent: yesterday
      }]
    })

    service.putMessage = (query) => Promise.resolve().then(() => {
      Code.expect(query.values[2]).to.not.be.empty()
      Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
      Code.expect(query.values[1]).to.equal('Update')
    })

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
    process.env.stage = 'prd'

    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        expires: tomorrow,
        sent: yesterday,
        references: yesterday.toISOString()
      }]
    })

    service.putMessage = (query) => Promise.resolve().then(() => {
      Code.expect(query.values[2]).to.not.be.empty()
      Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
      Code.expect(query.values[1]).to.equal('Update')
    })

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
    process.env.stage = 'prd'

    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        sent: yesterday,
        expires: tomorrow,
        msgType: 'Alert'
      }]
    })

    service.putMessage = (query) => Promise.resolve().then(() => {
      Code.expect(query.values[2]).to.not.be.empty()
      Code.expect(query.values[1]).to.equal('Update')
      Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
    })

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
    process.env.stage = 'prd'

    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        sent: yesterday,
        expires: tomorrow,
        msgType: 'Alert'
      }]
    })

    service.putMessage = (query) => Promise.resolve().then(() => {
      Code.expect(query.values[2]).to.not.be.empty()
      Code.expect(query.values[1]).to.equal('Update')
      Code.expect(query.values[2]).to.contain(yesterday.toISOString().substring(0, yesterday.toISOString().length - 5))
    })

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
    sinon.stub(aws.email, 'publishMessage').callsFake((message) => {
      return new Promise((resolve, reject) => {
        resolve()
      })
    })
    process.env.CPX_SNS_TOPIC = 'arn:aws:sns:region:account:topic'
    await Code.expect(processMessage(1)).to.reject()
  })

  lab.test('Bad data test 2', async () => {
    await Code.expect(processMessage({ bodyXml: '$%^&*' })).to.reject()
  })

  lab.test('Database error', async () => {
    service.putMessage = (query) => Promise.reject(new Error('unit test error'))
    const err = await Code.expect(processMessage(capAlert)).to.reject()
    Code.expect(err.message).to.equal('unit test error')
  })

  lab.test('Database error 2', async () => {
    service.getLastMessage = (id) => Promise.reject(new Error('unit test error'))

    const err = await Code.expect(processMessage(capAlert)).to.reject()
    Code.expect(err.message).to.equal('unit test error')
  })

  lab.test('Correct data test for processMessage where previous message is active and has reference', async () => {
    process.env.stage = 'prd'
    // Replace the trivial promise with Promise.resolve
    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        expires: tomorrow,
        sent: yesterday,
        references: 'Previous_Active_Message'
      }]
    })

    service.putMessage = (query) => Promise.resolve().then(() => {
      const lastDate = moment(yesterday).utc().format('YYYY-MM-DDTHH:mm:ssZ')
      Code.expect(query.values[2]).to.not.be.empty()
      Code.expect(query.values[1]).to.equal('Update')
      Code.expect(query.values[2]).to.contain(`Previous_Active_Message www.gov.uk/environment-agency,4eb3b7350ab7aa443650fc9351f2,${lastDate}`)
      Code.expect(query.values[2]).to.not.contain('00:00+00:00')
    })

    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.not.equal('Test')
    Code.expect(ret.body.status).to.equal('Actual')
  })
  lab.test('Invalid bodyXml format test', async () => {
    // Set bodyXml to an invalid value (e.g., null, undefined, or an object)
    const invalidBodyXml = null

    // Expect the processMessage function to reject due to validation failure
    await Code.expect(processMessage({ bodyXml: invalidBodyXml })).to.reject()
  })
  lab.test('Valid bodyXml format test', async () => {
    const validBodyXml = capAlert.bodyXml

    await Code.expect(processMessage({ bodyXml: validBodyXml })).to.not.reject()
  })
})
