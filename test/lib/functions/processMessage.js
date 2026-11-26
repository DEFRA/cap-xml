'use strict'

const fs = require('node:fs')
const path = require('node:path')
const xml2js = require('xml2js')
const { processMessage } = require('../../../lib/functions/processMessage')
const service = require('../../../lib/helpers/service')
const aws = require('../../../lib/helpers/aws')
const redis = require('../../../lib/helpers/redis')
const meteoalarm = require('../../../lib/helpers/meteoalarm')
const Message = require('../../../lib/models/message')

const nwsAlertXml = fs.readFileSync(path.join(__dirname, 'data', 'nws-alert.xml'), 'utf8')
const nwsAlert = { bodyXml: nwsAlertXml }
const ORIGINAL_ENV = process.env
const SNS_TOPIC = 'arn:aws:sns:region:account:topic'
const FAILED_BODY_LOG = '[processMessage] Failed message body:'
const tomorrow = new Date(Date.now() + (24 * 60 * 60 * 1000))
const identifier = '4eb3b7350ab7aa443650fc9351f02940E'
const identifierV2 = `2.49.0.1.826.1.20251106080027.${identifier}`
const code = 'MCP:v2.0'
const referencesV1 = 'www.gov.uk/environment-agency,4eb3b7350ab7aa443650fc9351f2,2020-01-01T00:00:00+00:00'
const referencesV2 = `www.gov.uk/environment-agency,${identifierV2},2020-01-01T00:00:00+00:00`
const V1_QUICKDIAL_PREFIX = '- For access to flood warning information offline call Floodline on 0345 988 1188 using'
const V1_QUICKDIAL = `${V1_QUICKDIAL_PREFIX} quickdial code: 210010.`
const V2_QUICKDIAL = '- call Floodline on 0345 988 1188, using quickdial code 210010'
const TARGET_AREA_URL = 'https://check-for-flooding.service.gov.uk/target-area/TESTWREA1'
// Without a quickdial number the quickdial sentence is removed, leaving this as the final line
const V2_LAST_LINE_WITHOUT_QUICKDIAL = '- monitor local weather, news and travel updates'
const SENT = '2025-11-06T08:00:27+00:00'

// Expected Meteoalarm (v2) content per CAP severity. Hard-coded rather than
// read from v2MessageMapping so that changes to the published wording are caught.
const V2_EXPECTED = {
  Minor: {
    severity: 'Minor',
    event: 'Flood Alert: Rivers Lowther and Eamont',
    headline: 'Flooding is possible: Rivers Lowther and Eamont',
    impact: 'Flooding is possible - be prepared',
    awarenessLevel: '1; green; Minor',
    instructionStart: 'Be prepared'
  },
  Moderate: {
    severity: 'Severe',
    event: 'Flood Warning: Rivers Lowther and Eamont',
    headline: 'Flooding is expected: Rivers Lowther and Eamont',
    impact: 'Flooding is expected - act now',
    awarenessLevel: '3; orange; Severe',
    instructionStart: 'Act now'
  },
  Severe: {
    severity: 'Extreme',
    event: 'Severe Flood Warning: Rivers Lowther and Eamont',
    headline: 'Danger to life: Rivers Lowther and Eamont',
    impact: 'Danger to life - act now',
    awarenessLevel: '4; red; Extreme',
    instructionStart: 'Act now - danger to life'
  }
}
V2_EXPECTED.Extreme = V2_EXPECTED.Severe
const SEVERITIES = Object.keys(V2_EXPECTED)

const withSeverity = (bodyXml, severity) => bodyXml.replace('<severity>Minor</severity>', `<severity>${severity}</severity>`)
const normalize = s => s.replace(/\r\n/g, '\n')
const parameterXml = (name, value) => `<parameter>
      <valueName>${name}</valueName>
      <value>${value}</value>
    </parameter>`

const expectedReferences = (base, { references, previousReferences }) => {
  if (!references) {
    return ''
  }
  return previousReferences ? `${base} ${base}` : base
}

const getPutQuery = () => service.putMessage.mock.calls[0][0]

// ***********************************************************
// Assertion helpers
// ***********************************************************
const expectResponseAndPutQuery = (response, putQuery, expected) => {
  expect(response).toEqual({
    statusCode: 200,
    body: {
      message: 'Cap message successfully stored for TESTWREA1',
      identifier,
      fwisCode: 'TESTWREA1',
      sent: '2025-11-06T08:00:27+00:00',
      expires: '2025-11-16T08:00:27+00:00',
      status: expected.status
    }
  })

  expect(putQuery.text).toBe('INSERT INTO "messages" ("identifier", "msg_type", "references", "alert", "fwis_code", "expires", "sent", "created", "identifier_v2", "references_v2", "alert_v2") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)')
  expect(putQuery.values).toEqual([
    identifier,
    expected.msgType,
    expectedReferences(referencesV1, expected),
    expect.stringContaining('<alert'),
    'TESTWREA1',
    '2025-11-16T08:00:27+00:00',
    '2025-11-06T08:00:27+00:00',
    '2020-01-01T00:00:00.000Z',
    identifierV2,
    expectedReferences(referencesV2, expected),
    expect.stringContaining('<alert')
  ])
}

const expectMessageV1 = (message, expected) => {
  expect(message).toMatchObject({
    identifier,
    status: expected.status,
    code: '',
    references: expectedReferences(referencesV1, expected),
    event: 'Update',
    severity: expected.severity,
    onset: '',
    headline: ''
  })
  expect(message.instruction).not.toContain(TARGET_AREA_URL)
  expect(message.instruction).not.toContain(V2_QUICKDIAL)
  expect(message.instruction).toContain(expected.quickdial ? V1_QUICKDIAL : V1_QUICKDIAL_PREFIX)
}

const expectMessageV2 = (message, expected) => {
  const v2 = V2_EXPECTED[expected.severity]
  expect(message).toMatchObject({
    identifier: identifierV2,
    status: expected.status,
    code,
    references: expectedReferences(referencesV2, expected),
    event: v2.event,
    severity: v2.severity,
    onset: SENT,
    headline: v2.headline,
    responseType: 'Monitor'
  })
  expect(message.instruction).toStartWith(v2.instructionStart)
  expect(message.instruction.trimEnd()).toEndWith(expected.quickdial ? V2_QUICKDIAL : V2_LAST_LINE_WITHOUT_QUICKDIAL)
  expect(message.instruction).not.toContain('{{')
  expect(message.instruction).toContain(TARGET_AREA_URL)
  expect(message.instruction.includes(V2_QUICKDIAL)).toBe(expected.quickdial)
  expect(message.instruction).not.toContain(expected.quickdial ? V1_QUICKDIAL : V1_QUICKDIAL_PREFIX)

  const messageString = normalize(message.toString())
  expect(messageString).toContain(parameterXml('awareness_level', v2.awarenessLevel))
  expect(messageString).toContain(parameterXml('awareness_type', '12; Flooding'))
  expect(messageString).toContain(parameterXml('impacts', v2.impact))
  expect(messageString).toContain(parameterXml('use_polygon_over_geocode', 'true'))
  expect(messageString).toContain(parameterXml('uk_ea_ta_code', 'TESTWREA1'))
  expect(messageString).not.toContain('<geocode>')
}

const expectRedisSet = () => {
  expect(redis.set).toHaveBeenCalledExactlyOnceWith(identifier, expect.objectContaining({
    identifier,
    alert: expect.stringContaining('<alert'),
    alert_v2: expect.stringContaining('<alert')
  }))
}

const expectMeteoalarmPost = (messageV2Xml) => {
  expect(meteoalarm.postWarning).toHaveBeenCalledExactlyOnceWith(messageV2Xml, identifier)
}

const expectFailedBodyLogged = (bodyXml) => {
  expect(console.log).toHaveBeenCalledWith(FAILED_BODY_LOG, bodyXml)
}
// ***********************************************************

describe('processMessage', () => {
  beforeEach(() => {
    // Only fake Date so that xmllint-wasm and promise scheduling are unaffected
    jest.useFakeTimers({
      now: new Date('2020-01-01T00:00:00Z'),
      doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout']
    })
    process.env = { ...ORIGINAL_ENV }
    delete process.env.stage
    delete process.env.CPX_SNS_TOPIC
    delete process.env.CPX_METEOALARM_DISABLE

    jest.spyOn(service, 'putMessage').mockResolvedValue()
    jest.spyOn(service, 'getLastMessage').mockResolvedValue({
      rows: [{
        id: '51',
        identifier: '4eb3b7350ab7aa443650fc9351f2'
      }]
    })
    jest.spyOn(redis, 'set').mockResolvedValue('OK')
    jest.spyOn(meteoalarm, 'postWarning').mockResolvedValue({ id: 'meteoalarm-warning-id' })
    jest.spyOn(aws.email, 'publishMessage').mockResolvedValue()
  })

  afterEach(() => {
    jest.useRealTimers()
    process.env = ORIGINAL_ENV
  })

  // ***********************************************************
  // Happy path tests
  // ***********************************************************
  const activeAlert = {
    id: '51',
    identifier: '4eb3b7350ab7aa443650fc9351f2',
    sent: '2020-01-01T00:00:00Z',
    expires: tomorrow,
    identifier_v2: identifierV2
  }
  const activeAlertWithReferences = {
    ...activeAlert,
    references: referencesV1,
    references_v2: referencesV2
  }

  describe.each([
    {
      name: 'no previous alert on test (empty array from db)',
      lastMessage: { rows: [] },
      expected: { status: 'Test', msgType: 'Alert', references: false }
    },
    {
      name: 'no previous alert on test (nothing resolved from db)',
      lastMessage: undefined,
      expected: { status: 'Test', msgType: 'Alert', references: false }
    },
    {
      name: 'an expired previous alert on production',
      stage: 'prd',
      expected: { status: 'Actual', msgType: 'Alert', references: false }
    },
    {
      name: 'an active alert on test',
      lastMessage: { rows: [activeAlert] },
      expected: { status: 'Test', msgType: 'Update', references: true }
    },
    {
      name: 'an active alert on production',
      stage: 'prd',
      lastMessage: { rows: [{ ...activeAlert, msgType: 'Alert' }] },
      expected: { status: 'Actual', msgType: 'Update', references: true }
    },
    {
      name: 'an active alert with references on test and no quickdial code',
      lastMessage: { rows: [activeAlertWithReferences] },
      transformXml: bodyXml => bodyXml.replace('quickdial code: 210010.', ''),
      expected: { status: 'Test', msgType: 'Update', references: true, previousReferences: true, quickdial: false }
    },
    {
      name: 'an active alert with references on production',
      stage: 'prd',
      lastMessage: { rows: [{ ...activeAlertWithReferences, msgType: 'Alert' }] },
      expected: { status: 'Actual', msgType: 'Update', references: true, previousReferences: true }
    }
  ])('with $name', (scenario) => {
    const { stage, lastMessage, transformXml = bodyXml => bodyXml, expected } = scenario

    beforeEach(() => {
      if (stage) {
        process.env.stage = stage
      }
      // Scenarios without a lastMessage key use the default (expired) previous message
      if ('lastMessage' in scenario) {
        service.getLastMessage.mockResolvedValue(lastMessage)
      }
    })

    it.each(SEVERITIES)('processes a %s message', async (severity) => {
      const bodyXml = withSeverity(transformXml(nwsAlertXml), severity)
      const fullExpected = { quickdial: true, previousReferences: false, ...expected, severity }

      const response = await processMessage({ bodyXml })

      const putQuery = getPutQuery()
      expectResponseAndPutQuery(response, putQuery, fullExpected)
      expectMessageV1(new Message(putQuery.values[3]), fullExpected)
      expectMessageV2(new Message(putQuery.values[10]), fullExpected)
      expectRedisSet()
      expectMeteoalarmPost(putQuery.values[10])
      expect(service.getLastMessage).toHaveBeenCalledExactlyOnceWith('TESTWREA1')
      expect(console.log).not.toHaveBeenCalledWith(FAILED_BODY_LOG, expect.anything())
    })
  })

  describe('previous message expiry boundary', () => {
    it.each([
      ['expires exactly now', '2020-01-01T00:00:00.000Z', ''],
      ['expires one millisecond from now', '2020-01-01T00:00:00.001Z', referencesV1]
    ])('builds references only when the previous message is still active (%s)', async (_description, expires, expectedRefs) => {
      service.getLastMessage.mockResolvedValue({ rows: [{ ...activeAlert, expires: new Date(expires) }] })

      await processMessage(nwsAlert)

      const putQuery = getPutQuery()
      expect(putQuery.values[2]).toBe(expectedRefs)
      expect(putQuery.values[1]).toBe(expectedRefs ? 'Update' : 'Alert')
    })
  })

  // ***********************************************************
  // Sad path tests
  // ***********************************************************
  describe('failures', () => {
    it('rejects an invalid event and notifies via SNS when configured', async () => {
      process.env.CPX_SNS_TOPIC = SNS_TOPIC

      await expect(processMessage(1)).rejects.toThrow('[500] "value" must be of type object')
      expect(aws.email.publishMessage).toHaveBeenCalledOnce()
    })

    it('rejects unparseable XML', async () => {
      await expect(processMessage({ bodyXml: '$%^&*' })).rejects.toThrow()
      expect(service.putMessage).not.toHaveBeenCalled()
    })

    it('rejects a null bodyXml', async () => {
      await expect(processMessage({ bodyXml: null })).rejects.toThrow('"bodyXml" must be a string')
    })

    it('rejects when storing the message fails', async () => {
      service.putMessage.mockRejectedValue(new Error('unit test error'))

      await expect(processMessage(nwsAlert)).rejects.toThrow('unit test error')
      expectFailedBodyLogged(nwsAlertXml)
    })

    it('rejects when fetching the last message fails', async () => {
      service.getLastMessage.mockRejectedValue(new Error('unit test error'))

      await expect(processMessage(nwsAlert)).rejects.toThrow('unit test error')
      expect(service.putMessage).not.toHaveBeenCalled()
    })

    it('rejects when xml2js fails to parse', async () => {
      jest.spyOn(xml2js, 'parseString').mockImplementation((_xml, callback) => callback(new Error('xml2js parse error')))

      // Error objects serialise to {} for both the v1 and v2 message
      await expect(processMessage(nwsAlert)).rejects.toHaveProperty('message', '[{},{}]')
      expect(xml2js.parseString).toHaveBeenCalledTimes(2)
      expect(service.putMessage).not.toHaveBeenCalled()
    })

    describe('validation errors', () => {
      const badAlert = { bodyXml: nwsAlertXml.replace(`<identifier>${identifier}</identifier>`, '') }

      it('rejects without an SNS message when no topic is configured', async () => {
        await expect(processMessage(badAlert)).rejects.toHaveProperty('message', expect.not.stringContaining('[500]'))
        expect(aws.email.publishMessage).not.toHaveBeenCalled()
        expectFailedBodyLogged(badAlert.bodyXml)
      })

      it('rejects with an SNS message when a topic is configured', async () => {
        process.env.CPX_SNS_TOPIC = SNS_TOPIC

        await expect(processMessage(badAlert)).rejects.toThrow('[500]')
        expect(aws.email.publishMessage).toHaveBeenCalledOnce()
        expectFailedBodyLogged(badAlert.bodyXml)
      })
    })

    describe('Meteoalarm failures', () => {
      beforeEach(() => {
        meteoalarm.postWarning.mockRejectedValue(new Error('Meteoalarm API unavailable'))
      })

      it('rejects without an SNS notification when no topic is configured', async () => {
        await expect(processMessage(nwsAlert)).rejects.toHaveProperty('message', 'Meteoalarm API unavailable')

        expectFailedBodyLogged(nwsAlertXml)
        expect(aws.email.publishMessage).not.toHaveBeenCalled()
        expect(service.putMessage).toHaveBeenCalledOnce()
        expect(redis.set).toHaveBeenCalledOnce()
      })

      it('rejects with an SNS notification when a topic is configured', async () => {
        process.env.CPX_SNS_TOPIC = SNS_TOPIC

        await expect(processMessage(nwsAlert)).rejects.toHaveProperty('message', '[500] Meteoalarm API unavailable')

        expect(aws.email.publishMessage).toHaveBeenCalledExactlyOnceWith({
          receivedMessage: JSON.stringify(nwsAlertXml),
          errorMessage: 'Meteoalarm API unavailable',
          dateCreated: '2020-01-01T00:00:00.000Z'
        })
        expectFailedBodyLogged(nwsAlertXml)
        expect(service.putMessage).toHaveBeenCalledOnce()
        expect(redis.set).toHaveBeenCalledOnce()
      })
    })

    it('rejects with [500] when the SNS notification itself fails', async () => {
      process.env.CPX_SNS_TOPIC = SNS_TOPIC
      service.putMessage.mockRejectedValue(new Error('database error'))
      aws.email.publishMessage.mockRejectedValue(new Error('SNS unavailable'))

      await expect(processMessage(nwsAlert)).rejects.toHaveProperty('message', '[500] SNS unavailable')
    })
  })

  // ***********************************************************
  // CPX_METEOALARM_DISABLE tests
  // ***********************************************************
  describe('CPX_METEOALARM_DISABLE', () => {
    it('does not post to Meteoalarm when set to "true"', async () => {
      process.env.CPX_METEOALARM_DISABLE = 'true'

      const response = await processMessage(nwsAlert)

      expect(response.statusCode).toBe(200)
      expect(response.body.identifier).toBe(identifier)
      expect(service.putMessage).toHaveBeenCalledOnce()
      expect(redis.set).toHaveBeenCalledOnce()
      expect(meteoalarm.postWarning).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[processMessage] Meteoalarm integration is disabled')
    })

    it.each([
      ['undefined', undefined],
      ['"false"', 'false'],
      ['any other value', 'something-else']
    ])('posts to Meteoalarm when %s', async (_description, value) => {
      if (value !== undefined) {
        process.env.CPX_METEOALARM_DISABLE = value
      }

      const response = await processMessage(nwsAlert)

      expect(response.statusCode).toBe(200)
      expect(response.body.identifier).toBe(identifier)
      expect(service.putMessage).toHaveBeenCalledOnce()
      expect(redis.set).toHaveBeenCalledOnce()
      expect(meteoalarm.postWarning).toHaveBeenCalledOnce()
    })

    it('does not post to Meteoalarm when set to "true" even if other operations fail', async () => {
      process.env.CPX_METEOALARM_DISABLE = 'true'
      service.putMessage.mockRejectedValue(new Error('database error'))

      await expect(processMessage(nwsAlert)).rejects.toThrow('database error')
      expect(meteoalarm.postWarning).not.toHaveBeenCalled()
    })
  })

  // ***********************************************************
  // Warning area vs alert area Meteoalarm routing tests
  // ***********************************************************
  describe('Meteoalarm routing', () => {
    it('forwards warning areas (5th char = w) to Meteoalarm', async () => {
      const response = await processMessage(nwsAlert)

      expect(response.statusCode).toBe(200)
      expect(response.body.fwisCode).toBe('TESTWREA1')
      expect(service.putMessage).toHaveBeenCalledOnce()
      expect(redis.set).toHaveBeenCalledOnce()
      expect(meteoalarm.postWarning).toHaveBeenCalledOnce()
    })

    it('does not forward alert areas (5th char = a) to Meteoalarm', async () => {
      const alertAreaXml = nwsAlertXml.replace('<value><![CDATA[TESTWREA1]]></value>', '<value><![CDATA[122WAF946]]></value>')

      const response = await processMessage({ bodyXml: alertAreaXml })

      expect(response.statusCode).toBe(200)
      expect(response.body.fwisCode).toBe('122WAF946')
      expect(service.putMessage).toHaveBeenCalledOnce()
      expect(redis.set).toHaveBeenCalledOnce()
      expect(meteoalarm.postWarning).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[processMessage] Meteoalarm integration disabled for alert area')
    })
  })
})
