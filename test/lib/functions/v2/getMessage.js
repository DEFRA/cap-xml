'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const Proxyquire = require('proxyquire').noCallThru()

lab.experiment('getMessage v2 wrapper', () => {
  lab.test('Calls getMessage helper with v2=true', async () => {
    const getMessageStub = sinon.stub().resolves({
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<alert>test</alert>'
    })

    const getMessage = Proxyquire('../../../../lib/functions/v2/getMessage', {
      '../../helpers/message': { getMessage: getMessageStub }
    }).getMessage

    const event = { pathParameters: { id: 'test123' } }
    await getMessage(event)

    Code.expect(getMessageStub.callCount).to.equal(1)
    Code.expect(getMessageStub.calledWith(event, true)).to.be.true()
  })

  lab.test('Returns the result from getMessage helper', async () => {
    const expectedResult = {
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<alert>v2 alert</alert>'
    }

    const getMessageStub = sinon.stub().resolves(expectedResult)

    const getMessage = Proxyquire('../../../../lib/functions/v2/getMessage', {
      '../../helpers/message': { getMessage: getMessageStub }
    }).getMessage

    const event = { pathParameters: { id: 'test123' } }
    const result = await getMessage(event)

    Code.expect(result).to.equal(expectedResult)
  })
})
