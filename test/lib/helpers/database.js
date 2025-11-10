'use strict'

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const sinon = require('sinon')
const Proxyquire = require('proxyquire')

const lab = exports.lab = Lab.script()

const ORIGINAL_ENV = process.env

lab.experiment('database helper', () => {
  let database
  let mockPoolInstance
  let mockPg

  lab.beforeEach(() => {
    // Mock environment
    process.env = { ...ORIGINAL_ENV }
    process.env.stage = 'mock-stage'
    process.env.CPX_REGION = 'mock-region'
    process.env.CPX_DB_USERNAME = 'mock-db-username'
    process.env.CPX_DB_PASSWORD = 'mock-db-password'
    process.env.CPX_DB_NAME = 'mock-db-name'
    process.env.CPX_DB_HOST = 'mock-db-host'
    process.env.CPX_AGW_URL = 'http://127.0.0.1'

    // Mock pg.Pool
    mockPoolInstance = {
      query: sinon.stub().resolves({ rows: [] }),
      end: sinon.stub().resolves(),
      ending: false
    }

    mockPg = {
      Pool: sinon.stub().returns(mockPoolInstance)
    }

    // Load module with mocked pg
    database = Proxyquire('../../../lib/helpers/database', {
      pg: mockPg
    })
  })

  lab.afterEach(() => {
    sinon.restore()
  })

  lab.test('init creates a new pool with correct config', () => {
    database.init()
    Code.expect(mockPg.Pool.calledOnce).to.be.true()
    Code.expect(mockPg.Pool.firstCall.args[0]).to.include({
      connectionString: 'postgresql://mock-db-username:mock-db-password@mock-db-host:5432/mock-db-name'
    })
  })

  lab.test('query uses existing pool to run SQL', async () => {
    database.init()
    await database.query('SELECT 1')
    Code.expect(mockPoolInstance.query.calledWith('SELECT 1')).to.be.true()
  })

  lab.test('query reinitializes pool if pool is ending', async () => {
    database.init()
    mockPoolInstance.ending = true
    await database.query('SELECT 1')
    Code.expect(mockPg.Pool.calledTwice).to.be.true()
    Code.expect(mockPoolInstance.query.calledWith('SELECT 1')).to.be.true()
  })
})
