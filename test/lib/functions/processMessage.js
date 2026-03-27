'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const xml2js = require('xml2js')
const processMessage = require('../../../lib/functions/processMessage').processMessage
const service = require('../../../lib/helpers/service')
const aws = require('../../../lib/helpers/aws')
const redis = require('../../../lib/helpers/redis')
const meteoalarm = require('../../../lib/helpers/meteoalarm')
const Message = require('../../../lib/models/message')
const v2MessageMapping = require('../../../lib/models/v2MessageMapping')
const nwsAlert = { bodyXml: fs.readFileSync(path.join(__dirname, 'data', 'nws-alert.xml'), 'utf8') }
const ORIGINAL_ENV = process.env
let clock
const tomorrow = new Date(new Date().getTime() + (24 * 60 * 60 * 1000))
const identifier = '4eb3b7350ab7aa443650fc9351f02940E'
const identifierV2 = `2.49.0.1.826.1.20251106080027.${identifier}`
const code = 'MCP:v2.0'
const referencesV1 = 'www.gov.uk/environment-agency,4eb3b7350ab7aa443650fc9351f2,2020-01-01T00:00:00+00:00'
const referencesV2 = 'www.gov.uk/environment-agency,2.49.0.1.826.1.20251106080027.4eb3b7350ab7aa443650fc9351f02940E,2020-01-01T00:00:00+00:00'

// ***********************************************************
// Helper functions
// ***********************************************************
const expectResponse = (response, putQuery, severity = 'Minor', status = 'Test', msgType = 'Alert', references = false, previousReferences = false, quickdialNumber = true) => {
  expectResponseAndPutQuery(response, putQuery, status, msgType, references, previousReferences)
  expectMessageV1(new Message(putQuery.values[3]), severity, status, references, previousReferences, quickdialNumber)
  expectMessageV2(new Message(putQuery.values[10]), severity, status, references, previousReferences, quickdialNumber)
  expectRedisSet(identifier)
  expectMeteoalarmPost(putQuery.values[10])
}

const expectRedisSet = (identifier) => {
  Code.expect(redis.set.calledOnce).to.be.true()
  const [key, value] = redis.set.firstCall.args
  Code.expect(key).to.equal(identifier)
  Code.expect(value).to.be.an.object()
  Code.expect(value.identifier).to.equal(identifier)
  Code.expect(value.alert).to.not.be.empty()
  Code.expect(value.alert_v2).to.not.be.empty()
}

const expectMeteoalarmPost = (messageV2Xml) => {
  Code.expect(meteoalarm.postWarning.calledOnce).to.be.true()
  const [xmlMessage, messageIdentifier] = meteoalarm.postWarning.firstCall.args
  Code.expect(xmlMessage).to.equal(messageV2Xml)
  Code.expect(messageIdentifier).to.equal(identifier)
}

const expectResponseAndPutQuery = (response, putQuery, status, msgType, references, previousReferences) => {
  // test response
  Code.expect(response.statusCode).to.equal(200)
  Code.expect(response.body.identifier).to.equal(identifier)
  Code.expect(response.body.fwisCode).to.equal('TESTWREA1')
  Code.expect(response.body.sent).to.equal('2025-11-06T08:00:27+00:00')
  Code.expect(response.body.expires).to.equal('2025-11-16T08:00:27+00:00')
  Code.expect(response.body.status).to.equal(status)

  // test putquery
  Code.expect(putQuery.text).to.equal('INSERT INTO "messages" ("identifier", "msg_type", "references", "alert", "fwis_code", "expires", "sent", "created", "identifier_v2", "references_v2", "alert_v2") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)')
  Code.expect(putQuery.values[0]).to.equal(identifier)
  Code.expect(putQuery.values[1]).to.equal(msgType)
  if (references) {
    Code.expect(putQuery.values[2]).to.equal(previousReferences ? `${referencesV1} ${referencesV1}` : referencesV1)
  } else {
    Code.expect(putQuery.values[2]).to.be.empty()
  }
  Code.expect(putQuery.values[3]).to.not.be.empty()
  Code.expect(putQuery.values[4]).to.equal('TESTWREA1')
  Code.expect(putQuery.values[5]).to.equal('2025-11-16T08:00:27+00:00')
  Code.expect(putQuery.values[6]).to.equal('2025-11-06T08:00:27+00:00')
  Code.expect(putQuery.values[7]).to.equal('2020-01-01T00:00:00.000Z')
  Code.expect(putQuery.values[8]).to.equal(identifierV2)
  if (references) {
    Code.expect(putQuery.values[9]).to.equal(previousReferences ? `${referencesV2} ${referencesV2}` : referencesV2)
  } else {
    Code.expect(putQuery.values[9]).to.be.empty()
  }
  Code.expect(putQuery.values[10]).to.not.be.empty()
}

const expectMessageV1 = (message, severity, status, references, previousReferences, quickdialNumber) => {
  Code.expect(message.identifier).to.equal(identifier)
  Code.expect(message.status).to.equal(status)
  Code.expect(message.code).to.equal('')
  if (references) {
    Code.expect(message.references).to.equal(previousReferences ? `${referencesV1} ${referencesV1}` : referencesV1)
  } else {
    Code.expect(message.references).to.be.empty()
  }
  Code.expect(message.event).to.equal('Update')
  Code.expect(message.severity).to.equal(severity)
  Code.expect(message.onset).to.equal('')
  Code.expect(message.headline).to.equal('')
  Code.expect(message.instruction).not.to.contain('https://check-for-flooding.service.gov.uk/target-area/TESTWREA1')
  if (quickdialNumber) {
    Code.expect(message.instruction).not.to.contain('- call Floodline on 0345 988 1188, using quickdial code 210010')
    Code.expect(message.instruction).to.contain('- For access to flood warning information offline call Floodline on 0345 988 1188 using quickdial code: 210010.')
  } else {
    Code.expect(message.instruction).not.to.contain('- call Floodline on 0345 988 1188, using quickdial code 210010')
    Code.expect(message.instruction).to.contain('- For access to flood warning information offline call Floodline on 0345 988 1188 using')
  }
}

const expectMessageV2 = (message, severity, status, references, previousReferences, quickdialNumber) => {
  const normalize = s => s.replace(/\r\n/g, '\n')
  const messageString = normalize(message.toString())
  const mapping = v2MessageMapping[severity]
  // Test message fields updated for message V2
  Code.expect(message.identifier).to.equal(identifierV2)
  Code.expect(message.status).to.equal(status)
  Code.expect(message.code).to.equal(code)
  if (references) {
    Code.expect(message.references).to.equal(previousReferences ? `${referencesV2} ${referencesV2}` : referencesV2)
  } else {
    Code.expect(message.references).to.be.empty()
  }
  Code.expect(message.event).to.equal(`${mapping.description}: Rivers Lowther and Eamont`)
  Code.expect(message.severity).to.equal(mapping.severity)
  Code.expect(message.onset).to.equal(message.sent)
  Code.expect(message.headline).to.equal(`${mapping.headline}: Rivers Lowther and Eamont`)
  Code.expect(message.instruction).to.contain('https://check-for-flooding.service.gov.uk/target-area/TESTWREA1')
  if (quickdialNumber) {
    Code.expect(message.instruction).to.contain('- call Floodline on 0345 988 1188, using quickdial code 210010')
    Code.expect(message.instruction).not.to.contain('- For access to flood warning information offline call Floodline on 0345 988 1188 using quickdial code: 210010.')
  } else {
    Code.expect(message.instruction).not.to.contain('- call Floodline on 0345 988 1188, using quickdial code 210010')
    Code.expect(message.instruction).not.to.contain('- For access to flood warning information offline call Floodline on 0345 988 1188 using')
  }
  // Test for parameters
  Code.expect(messageString).to.contain(`<parameter>
      <valueName>awareness_level</valueName>
      <value>${mapping.awarenessLevel}</value>
    </parameter>`)
  Code.expect(messageString).to.contain(`<parameter>
      <valueName>awareness_type</valueName>
      <value>12; Flooding</value>
    </parameter>`)
  Code.expect(messageString).to.contain(`<parameter>
      <valueName>impacts</valueName>
      <value>${mapping.impact}</value>
    </parameter>`)
  Code.expect(messageString).to.contain(`<parameter>
      <valueName>use_polygon_over_geocode</valueName>
      <value>true</value>
    </parameter>`)
  Code.expect(messageString).to.contain(`<parameter>
      <valueName>uk_ea_ta_code</valueName>
      <value>TESTWREA1</value>
    </parameter>`)
}
// ***********************************************************

lab.experiment('processMessage', () => {
  lab.beforeEach(() => {
    clock = sinon.useFakeTimers(new Date('2020-01-01T00:00:00Z').getTime())
    process.env = { ...ORIGINAL_ENV }
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
    // mock redis
    sinon.stub(redis, 'set').resolves('OK')
    // mock meteoalarm
    sinon.stub(meteoalarm, 'postWarning').resolves({ id: 'meteoalarm-warning-id' })
  })

  lab.afterEach(() => {
    clock.restore()
    sinon.restore()
  })

  lab.test('Correct data test with no previous alert on test (empty array from db)', async () => {
    service.getLastMessage = (id) => Promise.resolve({
      rows: []
    })

    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    // do alert and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    let response = await processMessage(nwsAlert)
    expectResponse(response, putQuery, 'Minor')

    // do warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Moderate</severity>') })
    expectResponse(response, putQuery, 'Moderate')

    // do severe warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Severe</severity>') })
    expectResponse(response, putQuery, 'Severe')
  })

  lab.test('Correct data test with no previous alert on test 2 (nothing resolved from db)', async () => {
    service.getLastMessage = () => {
      return new Promise((resolve) => {
        resolve()
      })
    }
    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })
    // do alert and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    let response = await processMessage(nwsAlert)
    expectResponse(response, putQuery, 'Minor')

    // do warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Moderate</severity>') })
    expectResponse(response, putQuery, 'Moderate')

    // do severe warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Severe</severity>') })
    expectResponse(response, putQuery, 'Severe')
  })

  lab.test('Correct data test with no previous alert on production, tests status switches to Actual', async () => {
    process.env.stage = 'prd'
    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    // do alert and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    let response = await processMessage(nwsAlert)
    expectResponse(response, putQuery, 'Minor', 'Actual')

    // do warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Moderate</severity>') })
    expectResponse(response, putQuery, 'Moderate', 'Actual')

    // do severe warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Severe</severity>') })
    expectResponse(response, putQuery, 'Severe', 'Actual')
  })

  lab.test('Correct data test with active alert on test', async () => {
    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        expires: tomorrow,
        sent: '2020-01-01T00:00:00Z',
        identifier_v2: identifierV2
      }]
    })

    let putQuery

    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    // do alert and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    let response = await processMessage(nwsAlert)
    expectResponse(response, putQuery, 'Minor', 'Test', 'Update', true)

    // do warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Moderate</severity>') })
    expectResponse(response, putQuery, 'Moderate', 'Test', 'Update', true)

    // do severe warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Severe</severity>') })
    expectResponse(response, putQuery, 'Severe', 'Test', 'Update', true)
  })

  lab.test('Correct alert data test with an active on production', async () => {
    process.env.stage = 'prd'

    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        sent: '2020-01-01T00:00:00Z',
        expires: tomorrow,
        msgType: 'Alert',
        identifier_v2: identifierV2
      }]
    })
    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    // do alert and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    let response = await processMessage(nwsAlert)
    expectResponse(response, putQuery, 'Minor', 'Actual', 'Update', true)

    // do warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Moderate</severity>') })
    expectResponse(response, putQuery, 'Moderate', 'Actual', 'Update', true)

    // do severe warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Severe</severity>') })
    expectResponse(response, putQuery, 'Severe', 'Actual', 'Update', true)
  })

  lab.test('Edge cases: Correct data test with active alert on test including references and no quickdial code', async () => {
    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        references: referencesV1,
        expires: tomorrow,
        sent: '2020-01-01T00:00:00Z',
        identifier_v2: identifierV2,
        references_v2: referencesV2
      }]
    })

    let putQuery

    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    // strip out quick dial code
    const alert = { bodyXml: nwsAlert.bodyXml.replace('quickdial code: 210010.', '') }

    // do alert and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    let response = await processMessage(alert)
    expectResponse(response, putQuery, 'Minor', 'Test', 'Update', true, true, false)

    // do warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: alert.bodyXml.replace('<severity>Minor</severity>', '<severity>Moderate</severity>') })
    expectResponse(response, putQuery, 'Moderate', 'Test', 'Update', true, true, false)

    // do severe warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: alert.bodyXml.replace('<severity>Minor</severity>', '<severity>Severe</severity>') })
    expectResponse(response, putQuery, 'Severe', 'Test', 'Update', true, true, false)
  })

  lab.test('Edge cases: Correct alert data test with an active on production including references and no quickdial code', async () => {
    process.env.stage = 'prd'

    service.getLastMessage = (id) => Promise.resolve({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2',
        references: referencesV1,
        sent: '2020-01-01T00:00:00Z',
        expires: tomorrow,
        msgType: 'Alert',
        identifier_v2: identifierV2,
        references_v2: referencesV2
      }]
    })
    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    // do alert and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    let response = await processMessage(nwsAlert)
    expectResponse(response, putQuery, 'Minor', 'Actual', 'Update', true, true)

    // do warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Moderate</severity>') })
    expectResponse(response, putQuery, 'Moderate', 'Actual', 'Update', true, true)

    // do severe warning and test output xml
    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()
    response = await processMessage({ bodyXml: nwsAlert.bodyXml.replace('<severity>Minor</severity>', '<severity>Severe</severity>') })
    expectResponse(response, putQuery, 'Severe', 'Actual', 'Update', true, true)
  })

  // ***********************************************************
  // Sad path tests
  // ***********************************************************
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
    const err = await Code.expect(processMessage(nwsAlert)).to.reject()
    Code.expect(err.message).to.equal('unit test error')
  })

  lab.test('Database error 2', async () => {
    service.getLastMessage = (id) => Promise.reject(new Error('unit test error'))

    const err = await Code.expect(processMessage(nwsAlert)).to.reject()
    Code.expect(err.message).to.equal('unit test error')
  })
  lab.test('Invalid bodyXml format test', async () => {
    // Set bodyXml to an invalid value (e.g., null, undefined, or an object)
    const invalidBodyXml = null

    // Expect the processMessage function to reject due to validation failure
    await Code.expect(processMessage({ bodyXml: invalidBodyXml })).to.reject()
  })
  lab.test('Handles xml2js error', async () => {
    sinon.stub(xml2js, 'parseString').callsFake((xml, callback) => {
      callback(new Error('xml2js parse error'))
    })
    await Code.expect(processMessage(nwsAlert)).to.reject()
  })

  lab.test('Throws error when pre/post validation has errors with no SNS message', async () => {
    const consoleLogStub = sinon.stub(console, 'log')
    const badAlert = { bodyXml: nwsAlert.bodyXml.replace('<identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>', '') }
    await Code.expect(processMessage(badAlert)).to.reject()
    // Check if bodyXml was logged with the new prefix format
    const bodyXmlLogCall = consoleLogStub.getCalls().find(call =>
      call.args[0] === '[processMessage] Failed message body:' && call.args[1] === badAlert.bodyXml
    )
    Code.expect(bodyXmlLogCall).to.exist()
    consoleLogStub.restore()
  })

  lab.test('Throws error when pre/post validation has errors with SNS message sent', async () => {
    sinon.stub(aws.email, 'publishMessage').resolves()
    process.env.CPX_SNS_TOPIC = 'arn:aws:sns:region:account:topic'
    const consoleLogStub = sinon.stub(console, 'log')
    const badAlert = { bodyXml: nwsAlert.bodyXml.replace('<identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>', '') }
    const err = await Code.expect(processMessage(badAlert)).to.reject()
    Code.expect(err.message).to.contain('[500]')
    Code.expect(aws.email.publishMessage.calledOnce).to.be.true()
    // Check if bodyXml was logged with the new prefix format
    const bodyXmlLogCall = consoleLogStub.getCalls().find(call =>
      call.args[0] === '[processMessage] Failed message body:' && call.args[1] === badAlert.bodyXml
    )
    Code.expect(bodyXmlLogCall).to.exist()
    consoleLogStub.restore()
  })

  lab.test('does not log when validator has no errors', async () => {
    const consoleLogStub = sinon.stub(console, 'log')
    service.putMessage = (query) => Promise.resolve()
    const response = await processMessage(nwsAlert)
    Code.expect(response.statusCode).to.equal(200)
    // Check that the error logging for validation didn't occur
    // (processMessage itself logs processing messages, so we check it doesn't log the bodyXml with error prefix)
    const bodyXmlErrorLog = consoleLogStub.getCalls().find(call =>
      call.args[0] === '[processMessage] Failed message body:'
    )
    Code.expect(bodyXmlErrorLog).to.not.exist()
    consoleLogStub.restore()
  })

  lab.test('Meteoalarm failure triggers error with no SNS notification (no SNS configured)', async () => {
    const consoleLogStub = sinon.stub(console, 'log')
    meteoalarm.postWarning.rejects(new Error('Meteoalarm API unavailable'))

    const putMessageStub = sinon.stub(service, 'putMessage').resolves()

    const err = await Code.expect(processMessage(nwsAlert)).to.reject()

    // Should throw the meteoalarm error
    Code.expect(err.message).to.equal('Meteoalarm API unavailable')

    // Should have logged the bodyXml with error prefix
    const bodyXmlLogCall = consoleLogStub.getCalls().find(call =>
      call.args[0] === '[processMessage] Failed message body:' && call.args[1] === nwsAlert.bodyXml
    )
    Code.expect(bodyXmlLogCall).to.exist()

    // Should have attempted other services before meteoalarm failed
    Code.expect(putMessageStub.calledOnce).to.be.true()
    Code.expect(redis.set.calledOnce).to.be.true()

    consoleLogStub.restore()
  })

  lab.test('Meteoalarm failure triggers error with SNS notification', async () => {
    sinon.stub(aws.email, 'publishMessage').resolves()
    process.env.CPX_SNS_TOPIC = 'arn:aws:sns:region:account:topic'
    const consoleLogStub = sinon.stub(console, 'log')
    meteoalarm.postWarning.rejects(new Error('Meteoalarm API unavailable'))

    const putMessageStub = sinon.stub(service, 'putMessage').resolves()

    const err = await Code.expect(processMessage(nwsAlert)).to.reject()

    // Should throw the error with [500] prefix
    Code.expect(err.message).to.contain('[500]')
    Code.expect(err.message).to.contain('Meteoalarm API unavailable')

    // Should have sent SNS notification
    Code.expect(aws.email.publishMessage.calledOnce).to.be.true()
    const publishArgs = aws.email.publishMessage.firstCall.args[0]
    Code.expect(publishArgs.receivedMessage).to.equal(JSON.stringify(nwsAlert.bodyXml))
    Code.expect(publishArgs.errorMessage).to.equal('Meteoalarm API unavailable')
    Code.expect(publishArgs.dateCreated).to.exist()

    // Should have logged the bodyXml with error prefix
    const bodyXmlLogCall = consoleLogStub.getCalls().find(call =>
      call.args[0] === '[processMessage] Failed message body:' && call.args[1] === nwsAlert.bodyXml
    )
    Code.expect(bodyXmlLogCall).to.exist()

    // Should have attempted other services before meteoalarm failed
    Code.expect(putMessageStub.calledOnce).to.be.true()
    Code.expect(redis.set.calledOnce).to.be.true()

    consoleLogStub.restore()
  })

  // ***********************************************************
  // CPX_METEOALARM_DISABLE tests
  // ***********************************************************
  lab.test('Meteoalarm post is disabled when CPX_METEOALARM_DISABLE is "true"', async () => {
    process.env.CPX_METEOALARM_DISABLE = 'true'

    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()

    const response = await processMessage(nwsAlert)

    Code.expect(response.statusCode).to.equal(200)
    Code.expect(response.body.identifier).to.equal(identifier)

    // Database and Redis should still be called
    Code.expect(putQuery).to.exist()
    Code.expect(redis.set.calledOnce).to.be.true()

    // Meteoalarm should NOT be called
    Code.expect(meteoalarm.postWarning.called).to.be.false()
  })

  lab.test('Meteoalarm post is enabled when CPX_METEOALARM_DISABLE is undefined', async () => {
    delete process.env.CPX_METEOALARM_DISABLE

    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()

    const response = await processMessage(nwsAlert)

    Code.expect(response.statusCode).to.equal(200)
    Code.expect(response.body.identifier).to.equal(identifier)

    // All three services should be called
    Code.expect(putQuery).to.exist()
    Code.expect(redis.set.calledOnce).to.be.true()
    Code.expect(meteoalarm.postWarning.calledOnce).to.be.true()
  })

  lab.test('Meteoalarm post is enabled when CPX_METEOALARM_DISABLE is "false"', async () => {
    process.env.CPX_METEOALARM_DISABLE = 'false'

    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()

    const response = await processMessage(nwsAlert)

    Code.expect(response.statusCode).to.equal(200)
    Code.expect(response.body.identifier).to.equal(identifier)

    // All three services should be called
    Code.expect(putQuery).to.exist()
    Code.expect(redis.set.calledOnce).to.be.true()
    Code.expect(meteoalarm.postWarning.calledOnce).to.be.true()
  })

  lab.test('Meteoalarm post is enabled when CPX_METEOALARM_DISABLE is any other value', async () => {
    process.env.CPX_METEOALARM_DISABLE = 'something-else'

    let putQuery
    service.putMessage = (query) => Promise.resolve().then(() => {
      putQuery = query
    })

    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()

    const response = await processMessage(nwsAlert)

    Code.expect(response.statusCode).to.equal(200)
    Code.expect(response.body.identifier).to.equal(identifier)

    // All three services should be called
    Code.expect(putQuery).to.exist()
    Code.expect(redis.set.calledOnce).to.be.true()
    Code.expect(meteoalarm.postWarning.calledOnce).to.be.true()
  })

  // ***********************************************************
  // Warning area vs alert area Meteoalarm routing tests
  // ***********************************************************
  lab.test('Warning area (5th char = w) forwards message to Meteoalarm', async () => {
    const putMessageStub = sinon.stub(service, 'putMessage').resolves()

    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()

    // nwsAlert uses TESTWREA1 - 5th character is 'W', a warning area
    const response = await processMessage(nwsAlert)

    Code.expect(response.statusCode).to.equal(200)
    Code.expect(response.body.fwisCode).to.equal('TESTWREA1')

    // DB and Redis should be called
    Code.expect(putMessageStub.calledOnce).to.be.true()
    Code.expect(redis.set.calledOnce).to.be.true()

    // Meteoalarm SHOULD be called for warning areas
    Code.expect(meteoalarm.postWarning.calledOnce).to.be.true()
  })

  lab.test('Alert area (5th char = a) does not forward message to Meteoalarm', async () => {
    // Replace the fwisCode with an alert area code: 122WAF946 (charAt(4) = 'A')
    const alertAreaXml = nwsAlert.bodyXml.replace('<value><![CDATA[TESTWREA1]]></value>', '<value><![CDATA[122WAF946]]></value>')

    const putMessageStub = sinon.stub(service, 'putMessage').resolves()

    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()

    const response = await processMessage({ bodyXml: alertAreaXml })

    Code.expect(response.statusCode).to.equal(200)
    Code.expect(response.body.fwisCode).to.equal('122WAF946')

    // DB and Redis should still be called
    Code.expect(putMessageStub.calledOnce).to.be.true()
    Code.expect(redis.set.calledOnce).to.be.true()

    // Meteoalarm should NOT be called for alert areas
    Code.expect(meteoalarm.postWarning.called).to.be.false()
  })

  lab.test('Meteoalarm post is disabled even when other operations fail if CPX_METEOALARM_DISABLE is "true"', async () => {
    process.env.CPX_METEOALARM_DISABLE = 'true'

    // Make database fail to ensure meteoalarm is still not called
    service.putMessage = (query) => Promise.reject(new Error('database error'))

    redis.set.resetHistory()
    meteoalarm.postWarning.resetHistory()

    const err = await Code.expect(processMessage(nwsAlert)).to.reject()

    Code.expect(err.message).to.equal('database error')

    // Meteoalarm should still NOT be called even though other operations were attempted
    Code.expect(meteoalarm.postWarning.called).to.be.false()
  })
})
