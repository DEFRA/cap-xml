'use strict'

const service = require('../helpers/service')

module.exports.archiveMessages = async () => {
  console.log('archiving messages')
  await service.archiveMessages()
}
