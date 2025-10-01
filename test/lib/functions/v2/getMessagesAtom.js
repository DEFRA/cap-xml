'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const Proxyquire = require('proxyquire').noCallThru()

lab.experiment('getMessagesAtom v2 wrapper', () => {
  lab.test('Calls messages helper with v2=true', async () => {
    const messagesStub = sinon.stub().resolves({
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<feed>test</feed>'
    })

    const getMessagesAtom = Proxyquire('../../../../lib/functions/v2/getMessagesAtom', {
      '../../helpers/messages': { messages: messagesStub }
    }).getMessagesAtom

    await getMessagesAtom()

    Code.expect(messagesStub.callCount).to.equal(1)
    Code.expect(messagesStub.calledWith(true)).to.be.true()
  })

  lab.test('Returns the result from messages helper', async () => {
    const expectedResult = {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<feed>v2 feed</feed>'
    }

    const messagesStub = sinon.stub().resolves(expectedResult)

    const getMessagesAtom = Proxyquire('../../../../lib/functions/v2/getMessagesAtom', {
      '../../helpers/messages': { messages: messagesStub }
    }).getMessagesAtom

    const result = await getMessagesAtom()

    Code.expect(result).to.equal(expectedResult)
  })
})
