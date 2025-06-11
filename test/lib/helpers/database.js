'use strict'

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')

const lab = exports.lab = Lab.script()
const { expect } = Code

const ORIGINAL_ENV = process.env

lab.experiment('database helper', () => {
  let sandbox
  let database
  let mockPoolInstance
  let mockPg

  lab.beforeEach(() => {
    sandbox = Sinon.createSandbox()

    // Mock environment
    process.env = { ...ORIGINAL_ENV }
    process.env.stage = 'dummy-stage'
    process.env.CPX_REGION = 'dummy-region'
    process.env.CPX_DB_USERNAME = 'dummy-db-username'
    process.env.CPX_DB_PASSWORD = 'dummy-db-password'
    process.env.CPX_DB_NAME = 'dummy-db-name'
    process.env.CPX_DB_HOST = 'dummy-db-host'
    process.env.CPX_AGW_URL = 'http://127.0.0.1'

    // Mock pg.Pool
    mockPoolInstance = {
      query: sandbox.stub().resolves({ rows: [] }),
      end: sandbox.stub().resolves(),
      ending: false
    }

    mockPg = {
      Pool: sandbox.stub().returns(mockPoolInstance)
    }

    // Load module with mocked pg
    database = Proxyquire('../../../lib/helpers/database', {
      pg: mockPg
    })
  })

  lab.afterEach(() => {
    sandbox.restore()
  })

  lab.test('init creates a new pool with correct config', () => {
    database.init()
    expect(mockPg.Pool.calledOnce).to.be.true()
    expect(mockPg.Pool.firstCall.args[0]).to.include({
      connectionString: 'postgresql://dummy-db-username:dummy-db-password@dummy-db-host:5432/dummy-db-name'
    })
  })

  lab.test('query uses existing pool to run SQL', async () => {
    database.init()
    await database.query('SELECT 1')
    expect(mockPoolInstance.query.calledWith('SELECT 1')).to.be.true()
  })

  lab.test('query reinitializes pool if pool is ending', async () => {
    database.init()
    mockPoolInstance.ending = true
    await database.query('SELECT 1')
    expect(mockPg.Pool.calledTwice).to.be.true()
    expect(mockPoolInstance.query.calledWith('SELECT 1')).to.be.true()
  })
})
