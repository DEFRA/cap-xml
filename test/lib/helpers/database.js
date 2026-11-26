'use strict'

jest.mock('pg', () => ({ Pool: jest.fn() }))

const ORIGINAL_ENV = process.env

describe('database helper', () => {
  let database
  let Pool
  let mockPoolInstance

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...ORIGINAL_ENV,
      CPX_DB_USERNAME: 'mock-db-username',
      CPX_DB_PASSWORD: 'mock-db-password',
      CPX_DB_NAME: 'mock-db-name',
      CPX_DB_HOST: 'mock-db-host'
    }

    mockPoolInstance = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      ending: false
    }
    Pool = require('pg').Pool
    Pool.mockImplementation(() => mockPoolInstance)

    database = require('../../../lib/helpers/database')
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('init creates a new pool with the correct connection string', () => {
    database.init()

    expect(Pool).toHaveBeenCalledExactlyOnceWith({
      connectionString: 'postgresql://mock-db-username:mock-db-password@mock-db-host:5432/mock-db-name'
    })
  })

  it('init reuses an existing pool', () => {
    database.init()
    database.init()

    expect(Pool).toHaveBeenCalledOnce()
  })

  it('query initialises the pool when required', async () => {
    await database.query('SELECT 1')

    expect(Pool).toHaveBeenCalledOnce()
  })

  it('query uses the existing pool to run SQL', async () => {
    database.init()

    const result = await database.query('SELECT $1', [1])

    expect(result).toEqual({ rows: [] })
    expect(mockPoolInstance.query).toHaveBeenCalledExactlyOnceWith('SELECT $1', [1])
    expect(Pool).toHaveBeenCalledOnce()
  })

  it('query reinitialises the pool if the pool is ending', async () => {
    database.init()
    mockPoolInstance.ending = true

    await database.query('SELECT 1')

    expect(Pool).toHaveBeenCalledTimes(2)
    expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT 1', undefined)
  })
})
