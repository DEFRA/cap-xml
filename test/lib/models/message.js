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

  lab.test('responseType defaults to empty string when missing', () => {
    Code.expect(message.responseType).to.equal('')
  })

  lab.test('setting responseType adds element when not present', () => {
    message.responseType = 'Prepare'
    Code.expect(message.responseType).to.equal('Prepare')
    Code.expect(message.toString()).to.include('<responseType>Prepare</responseType>')
  })

  lab.test('setting responseType updates existing element', () => {
    // First set to add the element
    message.responseType = 'Monitor'
    Code.expect(message.responseType).to.equal('Monitor')

    // Second set should update existing element
    message.responseType = 'Evacuate'
    Code.expect(message.responseType).to.equal('Evacuate')
    Code.expect(message.toString()).to.include('<responseType>Evacuate</responseType>')
    // Should only have one responseType element
    const responseTypeCount = (message.toString().match(/<responseType>/g) || []).length
    Code.expect(responseTypeCount).to.equal(1)
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

  lab.test('putQuery generates message for redis and SQL insert with correct values', () => {
    const { message: redisMessage, query: sql } = message.putQuery(message, messageV2)

    // Verify SQL query
    Code.expect(sql.text).to.equal('INSERT INTO "messages" ("identifier", "msg_type", "references", "alert", "fwis_code", "expires", "sent", "created", "identifier_v2", "references_v2", "alert_v2") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)')
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

    // Verify redis message object
    Code.expect(redisMessage).to.be.an.object()
    Code.expect(redisMessage.identifier).to.equal('4eb3b7350ab7aa443650fc9351f02940E')
    Code.expect(redisMessage.alert).to.not.be.empty()
    Code.expect(redisMessage.alert_v2).to.not.be.empty()
    Code.expect(redisMessage.alert).to.be.a.string()
    Code.expect(redisMessage.alert_v2).to.be.a.string()
    Code.expect(redisMessage.alert).to.include('<identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>')
    Code.expect(redisMessage.alert_v2).to.include('<identifier>4eb3b7350ab7aa443650fc9351f02940E</identifier>')
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
    Code.expect(messageBlank.responseType).to.equal('')
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
    messageBlank.responseType = 'Shelter'
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
    Code.expect(messageBlank.responseType).to.equal('Shelter')
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
    messageBlank.responseType = 'AllClear'
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
    Code.expect(messageBlank.responseType).to.equal('AllClear')
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

  lab.test('removeNode removes a single node from the document', () => {
    // Verify instruction exists before removal
    Code.expect(message.instruction).to.not.be.empty()
    Code.expect(message.toString()).to.include('<instruction>')

    // Remove instruction node
    message.removeNode('instruction')

    // Verify instruction is removed
    Code.expect(message.instruction).to.equal('')
    Code.expect(message.toString()).to.not.include('<instruction>')
  })

  lab.test('removeNode removes multiple nodes of the same type', () => {
    // Add multiple parameters
    message.addParameter('param1', 'value1')
    message.addParameter('param2', 'value2')
    message.addParameter('param3', 'value3')

    // Verify parameters exist
    const xmlBefore = message.toString()
    Code.expect(xmlBefore).to.include('<parameter>')
    Code.expect(xmlBefore).to.include('param1')
    Code.expect(xmlBefore).to.include('param2')
    Code.expect(xmlBefore).to.include('param3')

    // Remove all parameter nodes
    message.removeNode('parameter')

    // Verify all parameters are removed
    const xmlAfter = message.toString()
    Code.expect(xmlAfter).to.not.include('<parameter>')
    Code.expect(xmlAfter).to.not.include('param1')
    Code.expect(xmlAfter).to.not.include('param2')
    Code.expect(xmlAfter).to.not.include('param3')
  })

  lab.test('removeNode handles non-existent nodes gracefully', () => {
    const xmlBefore = message.toString()

    // Try to remove a node that doesn't exist
    message.removeNode('nonExistentNode')

    // XML should remain unchanged
    const xmlAfter = message.toString()
    Code.expect(xmlAfter).to.equal(xmlBefore)
  })

  lab.test('removeNode removes code node when present', () => {
    const messageWithCode = new Message(blankXml2)
    messageWithCode.code = 'TEST_CODE'

    // Verify code exists
    Code.expect(messageWithCode.code).to.equal('TEST_CODE')
    Code.expect(messageWithCode.toString()).to.include('<code>TEST_CODE</code>')

    // Remove code node
    messageWithCode.removeNode('code')

    // Verify code is removed
    Code.expect(messageWithCode.code).to.equal('')
    Code.expect(messageWithCode.toString()).to.not.include('<code>TEST_CODE</code>')
  })

  lab.test('removeNode removes references node', () => {
    message.references = 'REF123'

    // Verify references exists
    Code.expect(message.references).to.equal('REF123')
    Code.expect(message.toString()).to.include('<references>REF123</references>')

    // Remove references node
    message.removeNode('references')

    // Verify references is removed
    Code.expect(message.references).to.equal('')
    Code.expect(message.toString()).to.not.include('<references>')
  })
})
