'use strict'

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const sinon = require('sinon')

const lab = exports.lab = Lab.script()

lab.experiment('Service Helper', () => {
  let db
  let dbStub
  let queries
  let service

  lab.before(() => {
    delete require.cache[require.resolve('../../../lib/helpers/service.js')]
    db = require('../../../lib/helpers/database')
    queries = require('../../../lib/helpers/queries')
    service = require('../../../lib/helpers/service')
  })

  lab.beforeEach(() => {
    dbStub = sinon.stub(db, 'query')
  })

  lab.afterEach(() => {
    sinon.restore()
  })

  lab.after(() => {
    delete require.cache[require.resolve('../../../lib/helpers/service.js')]
  })

  lab.test('getMessage should call db.query with correct query and id', async () => {
    const fakeResult = { rows: [{ id: 1, fwis_code: 'mock-fwis-code' }] }
    dbStub.returns(fakeResult)

    const result = await service.getMessage(1)

    Code.expect(dbStub.calledWith(queries.getMessage, [1])).to.be.true()
    Code.expect(result).to.equal(fakeResult)
  })

  lab.test('getLastMessage should call db.query with correct query and id', async () => {
    const fakeResult = { rows: [{ id: 2, fwis_code: 'mock-fwis-code' }] }
    dbStub.resolves(fakeResult)

    const result = await service.getLastMessage(2)

    Code.expect(dbStub.calledWith(queries.getLastMessage, [2])).to.be.true()
    Code.expect(result).to.equal(fakeResult)
  })

  lab.test('getAllMessages should call db.query with correct query', async () => {
    const fakeResult = { rows: [] }
    dbStub.resolves(fakeResult)

    const result = await service.getAllMessages()

    Code.expect(dbStub.calledWith(queries.getAllMessages)).to.be.true()
    Code.expect(result).to.equal(fakeResult)
  })

  lab.test('putMessage should call db.query with provided query', async () => {
    const customQuery = 'INSERT INTO messages (fwis_code) VALUES (\'mock-fwis-code\')'
    const fakeResult = { rowCount: 1 }
    dbStub.resolves(fakeResult)

    const result = await service.putMessage(customQuery)

    Code.expect(dbStub.calledWith(customQuery)).to.be.true()
    Code.expect(result).to.equal(fakeResult)
  })

  lab.test('archiveMessages should call db.query with correct query', async () => {
    const fakeResult = { rowCount: 5 }
    dbStub.resolves(fakeResult)

    const result = await service.archiveMessages()

    Code.expect(dbStub.calledWith(queries.archiveMessages)).to.be.true()
    Code.expect(result).to.equal(fakeResult)
  })
})
