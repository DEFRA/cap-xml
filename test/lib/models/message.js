'use strict'

const fs = require('node:fs')
const path = require('node:path')
const Message = require('../../../lib/models/message')

const xml = fs.readFileSync(path.join(__dirname, '..', 'functions', 'data', 'nws-alert.xml'), 'utf8')
const IDENTIFIER = '4eb3b7350ab7aa443650fc9351f02940E'
const normalize = s => s.replace(/\r\n/g, '\n')
const countOccurrences = (text, search) => text.split(search).length - 1

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

const blankXmlSelfClosing = `<?xml version="1.0" encoding="UTF-8"?>
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

describe('Message model', () => {
  let message

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2020-01-01T00:00:00Z') })
    message = new Message(xml)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('getters', () => {
    it.each([
      ['identifier', IDENTIFIER],
      ['sender', 'www.gov.uk/environment-agency'],
      ['fwisCode', 'TESTWREA1'],
      ['msgType', 'Alert'],
      ['status', 'Actual'],
      ['sent', '2025-11-06T08:00:27+00:00'],
      ['expires', '2025-11-16T08:00:27+00:00'],
      ['references', ''],
      ['responseType', ''],
      ['quickdialNumber', '210010']
    ])('parses %s', (property, expected) => {
      expect(message[property]).toBe(expected)
    })

    it('parses instruction', () => {
      expect(message.instruction).toBe(`instructions
      - For access to flood warning information offline call Floodline on 0345 988 1188 using quickdial code: 210010.
      `)
    })

    it('isWarning is true when the 5th character of fwisCode is w', () => {
      expect(message.isWarning).toBeTrue()
    })

    it('isWarning is false when the 5th character of fwisCode is not w (alert area)', () => {
      const alertAreaMessage = new Message(xml.replace('<value><![CDATA[TESTWREA1]]></value>', '<value><![CDATA[122WAF946]]></value>'))

      expect(alertAreaMessage.isWarning).toBeFalse()
    })

    it('returns blank values for a blank message', () => {
      const messageBlank = new Message(blankXml)

      expect(messageBlank).toMatchObject({
        fwisCode: '',
        identifier: '',
        sender: '',
        msgType: '',
        references: '',
        status: '',
        expires: '',
        instruction: '',
        quickdialNumber: '',
        sent: '',
        code: '',
        event: '',
        responseType: '',
        severity: '',
        onset: '',
        headline: '',
        areaDesc: ''
      })
    })

    it('returns blank values when elements are missing entirely', () => {
      const messageEmpty = new Message('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"></alert>')

      expect(messageEmpty).toMatchObject({
        fwisCode: '',
        identifier: '',
        sender: '',
        msgType: '',
        status: '',
        sent: '',
        expires: '',
        references: '',
        code: '',
        event: '',
        responseType: '',
        severity: '',
        onset: '',
        headline: '',
        instruction: '',
        quickdialNumber: '',
        areaDesc: '',
        isWarning: false
      })
    })

    it.each([
      ['no space', 'quickdial code:210010.'],
      ['one space', 'quickdial code: 210010.'],
      ['several spaces', 'quickdial code:   210010.'],
      ['different case', 'Quickdial Code: 210010.']
    ])('parses the quickdial number with %s', (_description, text) => {
      const quickdialMessage = new Message(xml.replace('quickdial code: 210010.', text))

      expect(quickdialMessage.quickdialNumber).toBe('210010')
    })

    it.each([
      ['fewer than six digits', 'quickdial code: 21001.'],
      ['no trailing full stop', 'quickdial code: 210010']
    ])('does not parse a quickdial number with %s', (_description, text) => {
      const quickdialMessage = new Message(xml.replace('quickdial code: 210010.', text))

      expect(quickdialMessage.quickdialNumber).toBe('')
    })
  })

  describe('setters', () => {
    it('sets msgType', () => {
      message.msgType = 'Update'

      expect(message.msgType).toBe('Update')
    })

    it('sets status', () => {
      message.status = 'TestStatus'

      expect(message.status).toBe('TestStatus')
    })

    it('adds references and flips msgType from Alert to Update', () => {
      message.references = 'REF123'

      expect(message.references).toBe('REF123')
      expect(message.msgType).toBe('Update')
      expect(message.toString()).toContain('<references>REF123</references>')
    })

    it('does not flip msgType when it is not Alert', () => {
      message.msgType = 'Cancel'
      message.references = 'REF123'

      expect(message.msgType).toBe('Cancel')
    })

    it('updates existing references', () => {
      message.references = 'REF1'
      message.references = 'REF2'

      expect(message.references).toBe('REF2')
      expect(countOccurrences(message.toString(), '<references>')).toBe(1)
      expect(message.toString()).toContain('<references>REF2</references>')
    })

    it('adds responseType when not present', () => {
      message.responseType = 'Prepare'

      expect(message.responseType).toBe('Prepare')
      expect(message.toString()).toContain('<responseType>Prepare</responseType>')
    })

    it('updates an existing responseType', () => {
      message.responseType = 'Monitor'
      message.responseType = 'Evacuate'

      expect(message.responseType).toBe('Evacuate')
      expect(countOccurrences(message.toString(), '<responseType>')).toBe(1)
      expect(message.toString()).toContain('<responseType>Evacuate</responseType>')
    })

    it.each([
      ['self-closing elements', blankXmlSelfClosing],
      ['missing elements', blankXmlMissingFields]
    ])('sets every field on a blank message with %s', (_description, blank) => {
      const messageBlank = new Message(blank)
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

      expect(messageBlank).toMatchObject({
        identifier: 'ID123',
        references: 'REF123',
        // references setter flips msgType
        msgType: 'Update',
        status: 'Actual',
        code: 'CODE123',
        event: 'Test Event',
        responseType: 'Shelter',
        severity: 'Severe',
        onset: '2026-06-01T10:00:00-00:00',
        headline: 'Test Headline',
        instruction: 'Test Instruction'
      })
    })

    it.each([
      ['self-closing elements', blankXmlSelfClosing],
      ['missing elements', blankXmlMissingFields]
    ])('creates exactly one element per field when setting twice on a blank message with %s', (_description, blank) => {
      const messageBlank = new Message(blank)
      const fields = ['references', 'code', 'responseType', 'onset', 'headline', 'instruction']
      for (const value of ['first', 'second']) {
        for (const field of fields) {
          messageBlank[field] = value
        }
      }

      for (const field of fields) {
        expect(messageBlank.doc.getElementsByTagName(field)).toHaveLength(1)
        expect(messageBlank[field]).toBe('second')
      }
    })

    it('replaces existing instruction content', () => {
      message.instruction = 'New instruction'

      expect(message.instruction).toBe('New instruction')
      expect(message.quickdialNumber).toBe('')
    })
  })

  describe('addParameter', () => {
    const expectedParameters = `<parameter>
      <valueName>awareness_level</valueName>
      <value>awareness level</value>
    </parameter>
    <parameter>
      <valueName>awareness_type</valueName>
      <value>12; Flooding</value>
    </parameter>`

    it('appends parameters to info when there is no area', () => {
      const messageBlank = new Message(blankXmlMissingFields)
      messageBlank.addParameter('awareness_level', 'awareness level')
      messageBlank.addParameter('awareness_type', '12; Flooding')

      const output = normalize(messageBlank.toString())
      expect(output).toContain(expectedParameters)
      expect(output.indexOf('<parameter>')).toBeGreaterThan(output.indexOf('<description'))
    })

    it('inserts parameters before the area', () => {
      message.addParameter('awareness_level', 'awareness level')
      message.addParameter('awareness_type', '12; Flooding')

      const output = normalize(message.toString())
      expect(output).toContain(expectedParameters)
      expect(output.indexOf('</parameter>')).toBeLessThan(output.indexOf('<area>'))
    })
  })

  describe('removeNode', () => {
    it('removes a single node', () => {
      expect(message.instruction).not.toBeEmpty()

      message.removeNode('instruction')

      expect(message.instruction).toBe('')
      expect(message.toString()).not.toContain('<instruction>')
    })

    it('removes multiple nodes of the same type', () => {
      message.addParameter('param1', 'value1')
      message.addParameter('param2', 'value2')
      message.addParameter('param3', 'value3')
      expect(countOccurrences(message.toString(), '<parameter>')).toBe(3)

      message.removeNode('parameter')

      const output = message.toString()
      expect(output).not.toContain('<parameter>')
      for (const param of ['param1', 'param2', 'param3']) {
        expect(output).not.toContain(param)
      }
    })

    it('handles non-existent nodes gracefully', () => {
      const before = message.toString()

      message.removeNode('nonExistentNode')

      expect(message.toString()).toBe(before)
    })

    it('removes the code node', () => {
      const messageWithCode = new Message(blankXmlSelfClosing)
      messageWithCode.code = 'TEST_CODE'
      expect(messageWithCode.toString()).toContain('<code>TEST_CODE</code>')

      messageWithCode.removeNode('code')

      expect(messageWithCode.code).toBe('')
      expect(messageWithCode.toString()).not.toContain('<code>')
    })

    it('removes the references node', () => {
      message.references = 'REF123'

      message.removeNode('references')

      expect(message.references).toBe('')
      expect(message.toString()).not.toContain('<references>')
    })
  })

  describe('toString', () => {
    it('returns an XML string containing the identifier', () => {
      const output = message.toString()

      expect(output).toBeString()
      expect(output).toContain(`<identifier>${IDENTIFIER}</identifier>`)
    })
  })

  describe('putQuery', () => {
    it('generates the redis message and SQL insert with correct values', () => {
      const messageV2 = new Message(xml)
      messageV2.identifier = 'V2-ID'
      messageV2.references = 'V2-REF'

      const { message: redisMessage, query } = message.putQuery(message, messageV2)

      expect(query.text).toBe('INSERT INTO "messages" ("identifier", "msg_type", "references", "alert", "fwis_code", "expires", "sent", "created", "identifier_v2", "references_v2", "alert_v2") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)')
      expect(query.values).toEqual([
        IDENTIFIER,
        'Alert',
        '',
        message.toString(),
        'TESTWREA1',
        '2025-11-16T08:00:27+00:00',
        '2025-11-06T08:00:27+00:00',
        // TODO: bug change to not use Zulu shorthand timezone
        '2020-01-01T00:00:00.000Z',
        'V2-ID',
        'V2-REF',
        messageV2.toString()
      ])
      expect(redisMessage).toEqual({
        identifier: IDENTIFIER,
        msg_type: 'Alert',
        references: '',
        alert: message.toString(),
        fwis_code: 'TESTWREA1',
        expires: '2025-11-16T08:00:27+00:00',
        sent: '2025-11-06T08:00:27+00:00',
        created: '2020-01-01T00:00:00.000Z',
        identifier_v2: 'V2-ID',
        references_v2: 'V2-REF',
        alert_v2: messageV2.toString()
      })
    })
  })
})
