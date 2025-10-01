'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')

const Message = require('../../../lib/models/message')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>123456</identifier>
  <sender>www.gov.uk/environment-agency</sender>
  <sent>2026-05-28T11:00:02-00:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <source>Flood warning service</source>
  <scope>Public</scope>
  <info>
    <language>en-GB</language>
    <category>Met</category>
    <event><![CDATA[064 Issue Flood Alert EA]]></event>
    <urgency>Immediate</urgency>
    <severity>Minor</severity>
    <certainty>Likely</certainty>
    <expires>2026-05-29T11:00:02-00:00</expires>
    <senderName>Environment Agency</senderName>
    <area>
      <areaDesc>Area description</areaDesc>
      <polygon>points</polygon>
      <geocode>
        <valueName>TargetAreaCode</valueName>
        <value><![CDATA[TESTAREA]]></value>
      </geocode>
    </area>
  </info>
</alert>`

lab.experiment('Message class', () => {
  let message

  lab.beforeEach(() => {
    message = new Message(xml)
  })

  lab.test('parses identifier', () => {
    Code.expect(message.identifier).to.equal('123456')
  })

  lab.test('parses sender', () => {
    Code.expect(message.sender).to.equal('www.gov.uk/environment-agency')
  })

  lab.test('parses fwisCode (geocode value)', () => {
    Code.expect(message.fwisCode).to.equal('TESTAREA')
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
    Code.expect(message.sent).to.equal('2026-05-28T11:00:02-00:00')
  })

  lab.test('parses expires timestamp', () => {
    Code.expect(message.expires).to.equal('2026-05-29T11:00:02-00:00')
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
    // Initial: no references
    Code.expect(message.references).to.equal('')
    message.references = '' // falsy value
    Code.expect(message.references).to.equal('') // still unchanged
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

  lab.test('toString returns valid XML string containing identifier', () => {
    const xmlOut = message.toString()
    Code.expect(xmlOut).to.be.a.string()
    Code.expect(xmlOut).to.include('<identifier>123456</identifier>')
  })

  lab.test('putQuery generates SQL insert with correct values', () => {
    const sql = message.putQuery()
    Code.expect(sql.text).to.equal('INSERT INTO "messages" ("identifier", "msg_type", "references", "alert", "fwis_code", "expires", "sent", "created") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)')
    Code.expect(sql.values).to.include('123456')
    Code.expect(sql.values).to.include('TESTAREA')
    Code.expect(sql.values).to.include('2026-05-29T11:00:02-00:00')
  })
})
