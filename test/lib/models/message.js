'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const fs = require('node:fs')
const path = require('node:path')
const Message = require('../../../lib/models/message')
let clock
const xml = fs.readFileSync(path.join(__dirname, '..', 'functions', 'data', 'nws-alert.xml'), 'utf8')

const blankXml = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier></identifier>
  <sender></sender>
  <sent></sent>
  <status></status>
  <msgType></msgType>
  <source></source>
  <scope></scope>
  <info>
    <language></language>
    <category></category>
    <event></event>
    <urgency></urgency>
    <severity></severity>
    <certainty></certainty>
    <expires></expires>
    <senderName></senderName>
    <description></description>
    <instruction></instruction>
    <area>
      <areaDesc></areaDesc>
      <polygon></polygon>
      <geocode>
        <valueName></valueName>
        <value></value>
      </geocode>
    </area>
  </info>
</alert>`

const blankXml2 = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier />
  <sender />
  <sent />
  <status />
  <msgType />
  <source />
  <references />
  <scope />
  <code />
  <info>
    <language />
    <category />
    <event />
    <urgency />
    <severity />
    <onset />
    <certainty />
    <expires />
    <senderName />
    <description />
    <instruction />
    <headline />
    <area>
      <areaDesc />
      <polygon />
      <geocode>
        <valueName />
        <value />
      </geocode>
    </area>
  </info>
</alert>`

const blankXmlMissingFields = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier></identifier>
  <sender></sender>
  <sent></sent>
  <status></status>
  <msgType></msgType>
  <source></source>
  <scope></scope>
  <info>
    <language></language>
    <category></category>
    <event></event>
    <urgency></urgency>
    <severity></severity>
    <certainty></certainty>
    <expires></expires>
    <senderName></senderName>
    <description></description>
  </info>
</alert>`

lab.experiment('Message class', () => {
  let message, messageV2

  lab.beforeEach(() => {
    clock = sinon.useFakeTimers(new Date('2020-01-01T00:00:00Z').getTime())
    message = new Message(xml)
    messageV2 = new Message(xml)
  })

  lab.afterEach(() => {
    clock.restore()
    sinon.restore()
  })

  lab.test('parses identifier', () => {
    Code.expect(message.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
  })

  lab.test('parses sender', () => {
    Code.expect(message.sender).to.equal('www.gov.uk/environment-agency')
  })

  lab.test('parses fwisCode (geocode value)', () => {
    Code.expect(message.fwisCode).to.equal('TESTAREA1')
  })

  lab.test('parses msgType', () => {
    Code.expect(message.msgType).to.equal('Alert')
  })

  lab.test('can set msgType', () => {
    message.msgType = 'Update'
    Code.expect(message.msgType).to.equal('Update')
  })

  lab.test('parses status', () => {
    Code.expect(message.status).to.equal('Actual')
  })

  lab.test('can set status', () => {
    message.status = 'TestStatus'
    Code.expect(message.status).to.equal('TestStatus')
  })

  lab.test('parses sent timestamp', () => {
    Code.expect(message.sent).to.equal('2025-11-06T08:00:27+00:00')
  })

  lab.test('parses expires timestamp', () => {
    Code.expect(message.expires).to.equal('2025-11-16T08:00:27+00:00')
  })

  lab.test('references defaults to empty string when missing', () => {
    Code.expect(message.references).to.equal('')
  })

  lab.test('setting references adds element and flips msgType to Update', () => {
    message.references = 'REF123'
    Code.expect(message.references).to.equal('REF123')
    Code.expect(message.msgType).to.equal('Update')

    // ensure XML now contains <references>
    Code.expect(message.toString()).to.include('<references>REF123</references>')
  })

  lab.test('does not add references if value is falsy', () => {
    Code.expect(message.references).to.equal('')
    message.references = ''
    Code.expect(message.references).to.equal('')
    Code.expect(message.toString()).to.not.include('<references>')
  })

  lab.test('updating references when already set goes into else branch', () => {
    // First set adds it
    message.references = 'REF1'
    Code.expect(message.references).to.equal('REF1')

    // Second set should update existing <references>
    message.references = 'REF2'
    Code.expect(message.references).to.equal('REF2')
    Code.expect(message.toString()).to.include('<references>REF2</references>')
  })

  lab.test('parses quickdial number from instruction', () => {
    Code.expect(message.quickdialNumber).to.equal('210010')
  })

  lab.test('parses instruction', () => {
    Code.expect(message.instruction).to.equal(`instructions
      - For access to flood warning information offline call Floodline on 0345 988 1188 using quickdial code: 210010.
      `)
  })

  lab.test('toString returns valid XML string containing identifier', () => {
    const xmlOut = message.toString()
    Code.expect(xmlOut).to.be.a.string()
    Code.expect(xmlOut).to.include('<identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>')
  })

  lab.test('putQuery generates SQL insert with correct values', () => {
    const sql = message.putQuery(message, messageV2)
    Code.expect(sql.text).to.equal('INSERT INTO "messages" ("identifier", "msg_type", "references", "alert", "fwis_code", "expires", "sent", "created", "identifier_v2", "references_v2", "alert_v2") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)')
    // TODO need to test for more values and v2 values here
    Code.expect(sql.values[0]).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(sql.values[1]).to.equal('Alert')
    Code.expect(sql.values[2]).to.be.empty()
    Code.expect(sql.values[3]).to.not.be.empty()
    Code.expect(sql.values[4]).to.equal('TESTAREA1')
    Code.expect(sql.values[5]).to.equal('2025-11-16T08:00:27+00:00')
    Code.expect(sql.values[6]).to.equal('2025-11-06T08:00:27+00:00')
    Code.expect(sql.values[7]).to.equal('2020-01-01T00:00:00.000Z') // TODO: bug change to not use Zulu shorthand timezone
    Code.expect(sql.values[8]).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(sql.values[9]).to.be.empty()
    Code.expect(sql.values[10]).to.not.be.empty()
  })

  lab.test('blank message results in blank fields', () => {
    const messageBlank = new Message(blankXml)
    Code.expect(messageBlank.fwisCode).to.equal('')
    Code.expect(messageBlank.identifier).to.equal('')
    Code.expect(messageBlank.sender).to.equal('')
    Code.expect(messageBlank.msgType).to.equal('')
    Code.expect(messageBlank.references).to.equal('')
    Code.expect(messageBlank.status).to.equal('')
    Code.expect(messageBlank.expires).to.equal('')
    Code.expect(messageBlank.instruction).to.equal('')
    Code.expect(messageBlank.quickdialNumber).to.equal('')
    Code.expect(messageBlank.sent).to.equal('')
    Code.expect(messageBlank.code).to.equal('')
    Code.expect(messageBlank.event).to.equal('')
    Code.expect(messageBlank.severity).to.equal('')
    Code.expect(messageBlank.onset).to.equal('')
    Code.expect(messageBlank.headline).to.equal('')
    Code.expect(messageBlank.areaDesc).to.equal('')
  })

  lab.test('Test setters with blank message with <fieldName /> syntax', () => {
    const messageBlank = new Message(blankXml2)
    messageBlank.identifier = 'ID123'
    messageBlank.msgType = 'Alert'
    messageBlank.references = 'REF123'
    messageBlank.status = 'Actual'
    messageBlank.code = 'CODE123'
    messageBlank.event = 'Test Event'
    messageBlank.severity = 'Severe'
    messageBlank.onset = '2026-06-01T10:00:00-00:00'
    messageBlank.headline = 'Test Headline'
    messageBlank.instruction = 'Test Instruction'

    Code.expect(messageBlank.identifier).to.equal('ID123')
    Code.expect(messageBlank.references).to.equal('REF123')
    Code.expect(messageBlank.msgType).to.equal('Update') // references setter flips msgType
    Code.expect(messageBlank.status).to.equal('Actual')
    Code.expect(messageBlank.code).to.equal('CODE123')
    Code.expect(messageBlank.event).to.equal('Test Event')
    Code.expect(messageBlank.severity).to.equal('Severe')
    Code.expect(messageBlank.onset).to.equal('2026-06-01T10:00:00-00:00')
    Code.expect(messageBlank.headline).to.equal('Test Headline')
    Code.expect(messageBlank.instruction).to.equal('Test Instruction')
  })
  lab.test('Test setters with blank message and missing fields with <fieldName></fieldName> syntax', () => {
    const messageBlank = new Message(blankXmlMissingFields)
    messageBlank.identifier = 'ID123'
    messageBlank.msgType = 'Alert'
    messageBlank.references = 'REF123'
    messageBlank.status = 'Actual'
    messageBlank.code = 'CODE123'
    messageBlank.event = 'Test Event'
    messageBlank.severity = 'Severe'
    messageBlank.onset = '2026-06-01T10:00:00-00:00'
    messageBlank.headline = 'Test Headline'
    messageBlank.instruction = 'Test Instruction'

    Code.expect(messageBlank.identifier).to.equal('ID123')
    Code.expect(messageBlank.references).to.equal('REF123')
    Code.expect(messageBlank.msgType).to.equal('Update') // references setter flips msgType
    Code.expect(messageBlank.status).to.equal('Actual')
    Code.expect(messageBlank.code).to.equal('CODE123')
    Code.expect(messageBlank.event).to.equal('Test Event')
    Code.expect(messageBlank.severity).to.equal('Severe')
    Code.expect(messageBlank.onset).to.equal('2026-06-01T10:00:00-00:00')
    Code.expect(messageBlank.headline).to.equal('Test Headline')
    Code.expect(messageBlank.instruction).to.equal('Test Instruction')
  })

  lab.test('Setting parameters on a message (no getter available, so must check XML)', () => {
    const normalize = s => s.replace(/\r\n/g, '\n')
    const messageBlankMissingFields = new Message(blankXmlMissingFields)
    messageBlankMissingFields.addParameter('awareness_level', 'awareness level')
    messageBlankMissingFields.addParameter('awareness_type', '12; Flooding')
    messageBlankMissingFields.addParameter('impacts', 'headline')
    messageBlankMissingFields.addParameter('use_polygon_over_geocode', 'true')
    messageBlankMissingFields.addParameter('uk_ea_ta_code', 'fwisCode')

    Code.expect(normalize(messageBlankMissingFields.toString())).to.include(normalize(`<parameter>
      <valueName>awareness_level</valueName>
      <value>awareness level</value>
    </parameter>
    <parameter>
      <valueName>awareness_type</valueName>
      <value>12; Flooding</value>
    </parameter>
    <parameter>
      <valueName>impacts</valueName>
      <value>headline</value>
    </parameter>
    <parameter>
      <valueName>use_polygon_over_geocode</valueName>
      <value>true</value>
    </parameter>
    <parameter>
      <valueName>uk_ea_ta_code</valueName>
      <value>fwisCode</value>
    </parameter>`))
  })
})
