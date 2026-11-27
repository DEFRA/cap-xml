'use strict'

const { SNS } = require('@aws-sdk/client-sns')
const { email } = require('../../../lib/helpers/aws')

const ORIGINAL_ENV = process.env

describe('aws helper', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      stage: 'test',
      CPX_SNS_TOPIC: 'arn:aws:sns:region:account:topic'
    }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('email.publishMessage', () => {
    it('publishes a single SNS message with the correct parameters', async () => {
      const publishSpy = jest.spyOn(SNS.prototype, 'publish').mockResolvedValue({ MessageId: 'test-message-id' })

      const result = await email.publishMessage({
        errorMessage: 'Test Error',
        dateCreated: '2024-01-01',
        receivedMessage: 'Test Message'
      })

      expect(result).toEqual({ MessageId: 'test-message-id' })
      expect(publishSpy).toHaveBeenCalledExactlyOnceWith({
        Subject: 'Failed CAP XML warning message - test',
        Message: 'Error: Test Error, Date Created: 2024-01-01, Received Message: Test Message',
        TopicArn: 'arn:aws:sns:region:account:topic'
      })
    })

    it('propagates SNS publish failures', async () => {
      jest.spyOn(SNS.prototype, 'publish').mockRejectedValue(new Error('SNS unavailable'))

      await expect(email.publishMessage({})).rejects.toThrow('SNS unavailable')
    })
  })
})
