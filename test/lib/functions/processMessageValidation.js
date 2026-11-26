'use strict'

jest.mock('xmllint-wasm', () => ({ validateXML: jest.fn() }))

const fs = require('node:fs')
const path = require('node:path')
const xmllint = require('xmllint-wasm')
const { processMessage } = require('../../../lib/functions/processMessage')
const service = require('../../../lib/helpers/service')
const aws = require('../../../lib/helpers/aws')
const redis = require('../../../lib/helpers/redis')
const meteoalarm = require('../../../lib/helpers/meteoalarm')

const { validateXML: actualValidateXML } = jest.requireActual('xmllint-wasm')
const nwsAlert = { bodyXml: fs.readFileSync(path.join(__dirname, 'data', 'nws-alert.xml'), 'utf8') }
const ORIGINAL_ENV = process.env
const SNS_TOPIC = 'arn:aws:sns:region:account:topic'

// Expected error message builders
const NS = '{urn:oasis:names:tc:emergency:cap:1.2}'
const SETS = {
  msgType: "{'Alert', 'Update', 'Cancel', 'Ack', 'Error'}",
  scope: "{'Public', 'Restricted', 'Private'}",
  category: "{'Geo', 'Met', 'Safety', 'Security', 'Rescue', 'Fire', 'Health', 'Env', 'Transport', 'Infra', 'CBRNE', 'Other'}",
  urgency: "{'Immediate', 'Expected', 'Future', 'Past', 'Unknown'}",
  severity: "{'Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'}",
  certainty: "{'Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown'}"
}
const xsdAtomic = (element, value) => `Schemas validity error : Element '${NS}${element}': '${value}' is not a valid value of the local atomic type.`
const xsdEnum = (element, value) => `Schemas validity error : Element '${NS}${element}': [facet 'enumeration'] The value '${value}' is not an element of the set ${SETS[element]}.`
const joiEmpty = (field) => `"${field}" is not allowed to be empty`
const JOI_SENDER = '"alert.sender[0]" must be [www.gov.uk/environment-agency]'
const JOI_SEVERITY = '"alert.info[0].severity[0]" must be one of [Extreme, Severe, Moderate, Minor]'

const capXml = (fields) => `<?xml version="1.0" encoding="UTF-8"?>
      <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <identifier>${fields.identifier}</identifier>
      <sender>${fields.sender}</sender>
      <sent>${fields.sent}</sent>
      <status>${fields.value}</status>
      <msgType>${fields.value}</msgType>
      <source>${fields.source}</source>
      <scope>${fields.value}</scope>
      <info>
        <language>en-GB</language>
        <category>${fields.value}</category>
        <event><![CDATA[064 Issue Flood\r\nAlert EA]]></event>
        <urgency>${fields.value}</urgency>
        <severity>${fields.value}</severity>
        <certainty>${fields.value}</certainty>
        <expires>${fields.expires}</expires>
        <senderName>${fields.senderName}</senderName>
        <area>
          <areaDesc>${fields.areaDesc}</areaDesc>
          <polygon>${fields.polygon}</polygon>
          <geocode>
            <valueName>TargetAreaCode</valueName>
            <value><![CDATA[TESTWREA1]]></value>
          </geocode>
        </area>
        </info>
      </alert>
    `

const getErrorMessages = (err) => JSON.parse(err.message.replace('[500] ', '')).map(e => e.message)

describe('processMessage validation', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.CPX_SNS_TOPIC
    delete process.env.CPX_METEOALARM_DISABLE
    xmllint.validateXML.mockImplementation(actualValidateXML)
    jest.spyOn(service, 'getLastMessage').mockResolvedValue({ rows: [] })
    jest.spyOn(service, 'putMessage').mockResolvedValue()
    jest.spyOn(aws.email, 'publishMessage').mockResolvedValue()
    jest.spyOn(redis, 'set').mockResolvedValue('OK')
    jest.spyOn(meteoalarm, 'postWarning').mockResolvedValue({ id: 'meteoalarm-warning-id' })
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('with a mocked XSD validator', () => {
    it('rejects without an SNS message when no topic is configured', async () => {
      xmllint.validateXML.mockResolvedValue({ errors: [{ message: 'oops' }] })

      await expect(processMessage(nwsAlert)).rejects.toHaveProperty('message', '[{"message":"oops"},{"message":"oops"}]')
      expect(aws.email.publishMessage).not.toHaveBeenCalled()
    })

    it('rejects with an SNS message when a topic is configured', async () => {
      process.env.CPX_SNS_TOPIC = SNS_TOPIC
      xmllint.validateXML.mockResolvedValue({ errors: [{ message: 'oops' }] })

      await expect(processMessage(nwsAlert)).rejects.toHaveProperty('message', '[500] [{"message":"oops"},{"message":"oops"}]')
      expect(aws.email.publishMessage).toHaveBeenCalledOnce()
    })

    it.each([
      ['an empty errors array', { errors: [] }],
      ['no errors property', {}]
    ])('processes the message when the validator returns %s', async (_description, result) => {
      xmllint.validateXML.mockResolvedValue(result)

      await expect(processMessage(nwsAlert)).resolves.toHaveProperty('statusCode', 200)
      expect(console.log).toHaveBeenCalledWith('[processMessage] Finished processing CAP message: 4eb3b7350ab7aa443650fc9351f02940E for TESTWREA1')
      expect(console.log).not.toHaveBeenCalledWith('[processMessage] Failed message body:', expect.anything())
    })
  })

  describe('with the actual XSD validator', () => {
    it('leaves the v2 identifier empty when sent is missing', async () => {
      const bodyXml = nwsAlert.bodyXml.replace('<sent>2025-11-06T08:00:27+00:00</sent>', '<sent></sent>')

      const err = await processMessage({ bodyXml }).catch(e => e)

      // v1 keeps its identifier; only the generated v2 identifier is empty
      expect(getErrorMessages(err).filter(message => message === joiEmpty('alert.identifier[0]'))).toHaveLength(1)
      expect(service.putMessage).not.toHaveBeenCalled()
    })
    it('processes a valid message', async () => {
      process.env.CPX_SNS_TOPIC = SNS_TOPIC

      const ret = await processMessage(nwsAlert)

      expect(ret.statusCode).toBe(200)
      expect(ret.body).toMatchObject({
        identifier: '4eb3b7350ab7aa443650fc9351f02940E',
        fwisCode: 'TESTWREA1',
        sent: '2025-11-06T08:00:27+00:00',
        expires: '2025-11-16T08:00:27+00:00',
        status: 'Test'
      })
      expect(aws.email.publishMessage).not.toHaveBeenCalled()
      expect(redis.set).toHaveBeenCalledExactlyOnceWith('4eb3b7350ab7aa443650fc9351f02940E', expect.objectContaining({
        identifier: '4eb3b7350ab7aa443650fc9351f02940E',
        alert: expect.stringContaining('<alert'),
        alert_v2: expect.stringContaining('<alert')
      }))
    })

    it('rejects a message with empty fields', async () => {
      process.env.CPX_SNS_TOPIC = SNS_TOPIC
      const bodyXml = capXml({
        identifier: '',
        sender: '',
        sent: '',
        value: '',
        source: '',
        expires: '',
        senderName: '',
        areaDesc: '',
        polygon: ''
      })
      const joiErrors = [
        joiEmpty('alert.identifier[0]'),
        JOI_SENDER,
        joiEmpty('alert.sender[0]'),
        joiEmpty('alert.source[0]'),
        JOI_SEVERITY,
        joiEmpty('alert.info[0].severity[0]'),
        joiEmpty('alert.info[0].senderName[0]'),
        joiEmpty('alert.info[0].area[0].areaDesc[0]'),
        joiEmpty('alert.info[0].area[0].polygon[0]')
      ]

      const err = await processMessage({ bodyXml }).catch(e => e)

      expect(err.message).toStartWith('[500] ')
      expect(getErrorMessages(err)).toEqual([
        // v1 errors
        xsdAtomic('sent', ''),
        xsdEnum('msgType', ''),
        xsdEnum('scope', ''),
        xsdEnum('category', ''),
        xsdEnum('urgency', ''),
        xsdEnum('severity', ''),
        xsdEnum('certainty', ''),
        xsdAtomic('expires', ''),
        ...joiErrors,
        // v2 errors
        xsdAtomic('sent', ''),
        xsdEnum('msgType', ''),
        xsdEnum('scope', ''),
        xsdEnum('category', ''),
        xsdEnum('urgency', ''),
        xsdEnum('severity', ''),
        xsdEnum('certainty', ''),
        xsdAtomic('onset', ''),
        xsdAtomic('expires', ''),
        ...joiErrors
      ])
      expect(aws.email.publishMessage).toHaveBeenCalledOnce()
    })

    it('rejects a message with invalid fields', async () => {
      process.env.CPX_SNS_TOPIC = SNS_TOPIC
      const bodyXml = capXml({
        identifier: '4eb3b7350ab7aa443650fc9351f02940E',
        sender: 'invalid',
        sent: '2026-05-28',
        value: 'invalid',
        source: 'Flood warning service',
        expires: '2026-05-29',
        senderName: 'Environment Agency',
        areaDesc: 'Area description',
        polygon: 'points'
      })

      const err = await processMessage({ bodyXml }).catch(e => e)

      expect(err.message).toStartWith('[500] ')
      expect(getErrorMessages(err)).toEqual([
        // v1 errors
        xsdAtomic('sent', '2026-05-28'),
        xsdEnum('msgType', 'invalid'),
        xsdEnum('scope', 'invalid'),
        xsdEnum('category', 'invalid'),
        xsdEnum('urgency', 'invalid'),
        xsdEnum('severity', 'invalid'),
        xsdEnum('certainty', 'invalid'),
        xsdAtomic('expires', '2026-05-29'),
        JOI_SENDER,
        JOI_SEVERITY,
        // v2 errors
        xsdAtomic('sent', '2026-05-28'),
        xsdEnum('msgType', 'invalid'),
        xsdEnum('scope', 'invalid'),
        xsdEnum('category', 'invalid'),
        xsdEnum('urgency', 'invalid'),
        xsdEnum('severity', ''),
        xsdEnum('certainty', 'invalid'),
        xsdAtomic('onset', '2026-05-28'),
        xsdAtomic('expires', '2026-05-29'),
        JOI_SENDER,
        JOI_SEVERITY,
        joiEmpty('alert.info[0].severity[0]')
      ])
      expect(aws.email.publishMessage).toHaveBeenCalledOnce()
    })
  })
})
