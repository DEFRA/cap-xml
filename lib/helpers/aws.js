const { SNS } = require('@aws-sdk/client-sns')

const sns = new SNS()

module.exports = {
  email: {
    publishMessage: async (messageLog) => {
      return sns.publish({
        Subject: 'Failed CAP XML warning message - ' + process.env.stage,
        Message: `Error: ${messageLog.errorMessage}, Date Created: ${messageLog.dateCreated}, Received Message: ${messageLog.receivedMessage}`,
        TopicArn: process.env.CPX_SNS_TOPIC
      })
    }
  }
}
