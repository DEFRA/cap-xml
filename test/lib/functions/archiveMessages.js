'use strict'

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const sinon = require('sinon')

const lab = exports.lab = Lab.script()
const { archiveMessages } = require('../../../lib/functions/archiveMessages')
const service = require('../../../lib/helpers/service')

lab.experiment('archiveMessages', () => {
  lab.afterEach(() => {
    sinon.restore()
  })

  lab.test('calls service.archiveMessages', async () => {
    const stub = sinon.stub(service, 'archiveMessages')

    await archiveMessages()

    Code.expect(stub.calledOnce).to.be.true()
  })

  lab.test('propagates error from service.archiveMessages', async () => {
    sinon.stub(service, 'archiveMessages').rejects(new Error('DB failure'))

    await Code.expect(archiveMessages()).to.reject(Error, 'DB failure')
  })
})
