'use strict'

const service = require('../helpers/service')

module.exports.archiveMessages = async () => {
  console.log('[archiveMessages] Starting to archive messages')
  await service.archiveMessages()
  console.log('[archiveMessages] Finished archiving messages')
}
