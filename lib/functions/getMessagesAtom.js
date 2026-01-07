const { messages } = require('../helpers/messages')

module.exports.getMessagesAtom = () => {
  return messages(false)
}
