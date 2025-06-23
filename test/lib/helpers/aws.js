const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const { mockClient } = require('aws-sdk-client-mock')
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

const { email } = require('../../../lib/helpers/aws')

lab.experiment('AWS Helper Tests', () => {
  const snsMock = mockClient(SNSClient)

  lab.beforeEach(() => {
    process.env.stage = 'test'
    process.env.CPX_SNS_TOPIC = 'arn:aws:sns:region:account:topic'
    snsMock.reset()
  })

  lab.afterEach(() => {
    sinon.restore()
    delete process.env.stage
    delete process.env.CPX_SNS_TOPIC
  })

  lab.experiment('email.publishMessage', () => {
    lab.test('verifies SNS publish is called once with correct parameters', async () => {
      // Setup mock response
      snsMock.on(PublishCommand).resolves({
        MessageId: 'test-message-id'
      })

      const messageLog = {
        errorMessage: 'Test Error',
        dateCreated: '2024-01-01',
        receivedMessage: 'Test Message'
      }

      await email.publishMessage(messageLog)

      // Verify the mock was called
      const publishCalls = snsMock.commandCalls(PublishCommand)
      Code.expect(publishCalls).to.have.length(1)

      // Get the parameters passed to publish
      const publishParams = publishCalls[0].args[0].input

      // Verify parameters
      Code.expect(publishParams.TopicArn).to.equal(process.env.CPX_SNS_TOPIC)
      Code.expect(publishParams.Subject).to.equal('Failed CAP XML warning message - test')
      Code.expect(publishParams.Message).to.contain('Test Error')
      Code.expect(publishParams.Message).to.contain('2024-01-01')
      Code.expect(publishParams.Message).to.contain('Test Message')
    })
  })
})
