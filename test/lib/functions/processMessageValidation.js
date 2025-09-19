'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const Proxyquire = require('proxyquire').noCallThru()
const sinon = require('sinon')
const capAlert = require('./data/capAlert.json')

const fakeService = {
  getLastMessage: async () => ({ rows: [] }),
  putMessage: async () => {}
}
const FakeMessage = function () {
  this.data = {
    alert: '<alert>test</alert>',
    identifier: 'id123',
    fwis_code: 'FWC',
    sent: '2020-01-01T00:00:00Z',
    expires: '2020-01-02T00:00:00Z'
  }
  this.putQuery = {}
}
const fakeSchema = { validateAsync: async () => ({ error: null }) }
const fakeAws = { email: { publishMessage: sinon.stub() } }

const loadWithValidateMock = (validateMock) => {
  return Proxyquire('../../../lib/functions/processMessage', {
    'xmllint-wasm': { validateXML: validateMock },
    '../helpers/service': fakeService,
    '../models/message': FakeMessage,
    '../schemas/processMessageEventSchema': fakeSchema,
    '../helpers/aws': fakeAws
  }).processMessage
}

const CPX_SNS_TOPIC = process.env.CPX_SNS_TOPIC

lab.experiment('processMessage validation logging', () => {
  lab.afterEach(() => {
    process.env.CPX_SNS_TOPIC = CPX_SNS_TOPIC
  })
  lab.test('Throws error when pre/post validation has errors with no SNS message', async () => {
    const validateMock = async () => ({ errors: [{ message: 'oops' }] })
    const processMessage = loadWithValidateMock(validateMock)

    await Code.expect(processMessage(capAlert))
      .to
      .reject('[{"message":"oops"}]')
    Code.expect(fakeAws.email.publishMessage.callCount).to.equal(0)
  })

  lab.test('Throws error when pre/post validation has errors with SNS message sent', async () => {
    process.env.CPX_SNS_TOPIC = true
    const validateMock = async () => ({ errors: [{ message: 'oops' }] })
    const processMessage = loadWithValidateMock(validateMock)

    await Code.expect(processMessage(capAlert))
      .to
      .reject('[500] [{"message":"oops"}]')

    Code.expect(fakeAws.email.publishMessage.callCount).to.equal(1)
  })

  lab.test('does not log when validator has no errors', async () => {
    const validateMock = async () => ({ errors: [] })
    const processMessage = loadWithValidateMock(validateMock)

    const logs = []
    const origLog = console.log
    console.log = (msg) => logs.push(String(msg))

    try {
      await processMessage(capAlert)
      Code.expect(logs).to.include('Finished processing CAP message: id123 for FWC')
      Code.expect(logs.some(l => l.includes('failed validation'))).to.be.false()
    } finally {
      console.log = origLog
    }
  })

  lab.test('Processes a message correctly if valid with actual xmllint', async () => {
    process.env.CPX_SNS_TOPIC = true
    const awsStub = { email: { publishMessage: sinon.stub() } }
    const processMessage = Proxyquire('../../../lib/functions/processMessage', {
      '../helpers/service': fakeService,
      '../schemas/processMessageEventSchema': fakeSchema,
      '../helpers/aws': awsStub
    }).processMessage

    const ret = await processMessage(capAlert)
    Code.expect(ret.statusCode).to.equal(200)
    Code.expect(ret.body.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(ret.body.fwisCode).to.equal('TESTAREA1')
    Code.expect(ret.body.sent).to.equal('2017-05-28T11:00:02-00:00')
    Code.expect(ret.body.expires).to.equal('2017-05-29T11:00:02-00:00')
    Code.expect(ret.body.status).to.equal('Test')

    Code.expect(awsStub.email.publishMessage.callCount).to.equal(0)
  })

  lab.test('Throws validation errors for empty fields', async () => {
    process.env.CPX_SNS_TOPIC = true
    const message = {}
    message.bodyXml = `<?xml version="1.0" encoding="UTF-8"?>
      <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <identifier></identifier>
      <sender></sender>
      <sent></sent>
      <status></status>
      <msgType></msgType>
      <source></source>
      <scope></scope>
      <info>
        <language>en-GB</language>
        <category></category>
        <event><![CDATA[064 Issue Flood\r\nAlert EA]]></event>
        <urgency></urgency>
        <severity></severity>
        <certainty></certainty>
        <expires></expires>
        <senderName></senderName>
        <area>
          <areaDesc></areaDesc>
          <polygon></polygon>
          <geocode>
            <valueName>TargetAreaCode</valueName>
            <value><![CDATA[TESTAREA1]]></value>
          </geocode>
        </area>
        </info>
      </alert>
    `
    process.env.CPX_SNS_TOPIC = true
    const awsStub = { email: { publishMessage: sinon.stub() } }
    const processMessage = Proxyquire('../../../lib/functions/processMessage', {
      '../helpers/service': fakeService,
      '../schemas/processMessageEventSchema': fakeSchema,
      '../helpers/aws': awsStub
    }).processMessage

    const ret = await Code.expect(processMessage(message))
      .to
      .reject()
    const errors = JSON.parse(ret.message.replace('[500] ', ''))

    Code.expect(errors.length).to.equal(16)
    // Helper to generate message asserts below
    // errors.forEach((er, i) => {
    //   console.log(`Code.expect(errors[${i}].message).to.equal('${er.message.replace(/'/g, "\\'")}')`)
    // })

    Code.expect(errors[0].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}sent\': \'\' is not a valid value of the local atomic type.')
    Code.expect(errors[1].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}status\': [facet \'enumeration\'] The value \'\' is not an element of the set {\'Actual\', \'Exercise\', \'System\', \'Test\', \'Draft\'}.')
    Code.expect(errors[2].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}msgType\': [facet \'enumeration\'] The value \'\' is not an element of the set {\'Alert\', \'Update\', \'Cancel\', \'Ack\', \'Error\'}.')
    Code.expect(errors[3].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}scope\': [facet \'enumeration\'] The value \'\' is not an element of the set {\'Public\', \'Restricted\', \'Private\'}.')
    Code.expect(errors[4].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}category\': [facet \'enumeration\'] The value \'\' is not an element of the set {\'Geo\', \'Met\', \'Safety\', \'Security\', \'Rescue\', \'Fire\', \'Health\', \'Env\', \'Transport\', \'Infra\', \'CBRNE\', \'Other\'}.')
    Code.expect(errors[5].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}urgency\': [facet \'enumeration\'] The value \'\' is not an element of the set {\'Immediate\', \'Expected\', \'Future\', \'Past\', \'Unknown\'}.')
    Code.expect(errors[6].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}severity\': [facet \'enumeration\'] The value \'\' is not an element of the set {\'Extreme\', \'Severe\', \'Moderate\', \'Minor\', \'Unknown\'}.')
    Code.expect(errors[7].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}certainty\': [facet \'enumeration\'] The value \'\' is not an element of the set {\'Observed\', \'Likely\', \'Possible\', \'Unlikely\', \'Unknown\'}.')
    Code.expect(errors[8].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}expires\': \'\' is not a valid value of the local atomic type.')
    Code.expect(errors[9].message).to.equal('"alert.identifier[0]" is not allowed to be empty')
    Code.expect(errors[10].message).to.equal('"alert.sender[0]" must be [www.gov.uk/environment-agency]')
    Code.expect(errors[11].message).to.equal('"alert.sender[0]" is not allowed to be empty')
    Code.expect(errors[12].message).to.equal('"alert.source[0]" is not allowed to be empty')
    Code.expect(errors[13].message).to.equal('"alert.info[0].senderName[0]" is not allowed to be empty')
    Code.expect(errors[14].message).to.equal('"alert.info[0].area[0].areaDesc[0]" is not allowed to be empty')
    Code.expect(errors[15].message).to.equal('"alert.info[0].area[0].polygon[0]" is not allowed to be empty')

    Code.expect(awsStub.email.publishMessage.callCount).to.equal(1)
  })
  lab.test('Throws validation errors for invalid fields', async () => {
    process.env.CPX_SNS_TOPIC = true
    const message = {}
    message.bodyXml = `<?xml version="1.0" encoding="UTF-8"?>
      <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>
      <sender>invalid</sender>
      <sent>2026-05-28</sent>
      <status>invalid</status>
      <msgType>invalid</msgType>
      <source>Flood warning service</source>
      <scope>invalid</scope>
      <info>
        <language>en-GB</language>
        <category>invalid</category>
        <event><![CDATA[064 Issue Flood\r\nAlert EA]]></event>
        <urgency>invalid</urgency>
        <severity>invalid</severity>
        <certainty>invalid</certainty>
        <expires>2026-05-29</expires>
        <senderName>Environment Agency</senderName>
        <area>
          <areaDesc>Area description</areaDesc>
          <polygon>points</polygon>
          <geocode>
            <valueName>TargetAreaCode</valueName>
            <value><![CDATA[TESTAREA1]]></value>
          </geocode>
        </area>
        </info>
      </alert>
    `
    process.env.CPX_SNS_TOPIC = true
    const awsStub = { email: { publishMessage: sinon.stub() } }
    const processMessage = Proxyquire('../../../lib/functions/processMessage', {
      '../helpers/service': fakeService,
      '../schemas/processMessageEventSchema': fakeSchema,
      '../helpers/aws': awsStub
    }).processMessage

    const ret = await Code.expect(processMessage(message))
      .to
      .reject()
    const errors = JSON.parse(ret.message.replace('[500] ', ''))
    Code.expect(errors.length).to.equal(10)
    Code.expect(errors[0].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}sent\': \'2026-05-28\' is not a valid value of the local atomic type.')
    Code.expect(errors[1].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}status\': [facet \'enumeration\'] The value \'invalid\' is not an element of the set {\'Actual\', \'Exercise\', \'System\', \'Test\', \'Draft\'}.')
    Code.expect(errors[2].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}msgType\': [facet \'enumeration\'] The value \'invalid\' is not an element of the set {\'Alert\', \'Update\', \'Cancel\', \'Ack\', \'Error\'}.')
    Code.expect(errors[3].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}scope\': [facet \'enumeration\'] The value \'invalid\' is not an element of the set {\'Public\', \'Restricted\', \'Private\'}.')
    Code.expect(errors[4].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}category\': [facet \'enumeration\'] The value \'invalid\' is not an element of the set {\'Geo\', \'Met\', \'Safety\', \'Security\', \'Rescue\', \'Fire\', \'Health\', \'Env\', \'Transport\', \'Infra\', \'CBRNE\', \'Other\'}.')
    Code.expect(errors[5].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}urgency\': [facet \'enumeration\'] The value \'invalid\' is not an element of the set {\'Immediate\', \'Expected\', \'Future\', \'Past\', \'Unknown\'}.')
    Code.expect(errors[6].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}severity\': [facet \'enumeration\'] The value \'invalid\' is not an element of the set {\'Extreme\', \'Severe\', \'Moderate\', \'Minor\', \'Unknown\'}.')
    Code.expect(errors[7].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}certainty\': [facet \'enumeration\'] The value \'invalid\' is not an element of the set {\'Observed\', \'Likely\', \'Possible\', \'Unlikely\', \'Unknown\'}.')
    Code.expect(errors[8].message).to.equal('Schemas validity error : Element \'{urn:oasis:names:tc:emergency:cap:1.2}expires\': \'2026-05-29\' is not a valid value of the local atomic type.')
    Code.expect(errors[9].message).to.equal('"alert.sender[0]" must be [www.gov.uk/environment-agency]')

    Code.expect(awsStub.email.publishMessage.callCount).to.equal(1)
  })
})
