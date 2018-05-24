'use strict'

const service = require('../helpers/service')

module.exports.archiveMessages = async () => {
  try {
    console.log('archiving messages')
    await service.archiveMessages()
  } catch (err) {
    throw err
  }
}
