const { getMessage } = require('../helpers/message')

module.exports.getMessage = (event) => {
  return getMessage(event, false)
}
