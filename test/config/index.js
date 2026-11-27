'use strict'

const ORIGINAL_ENV = process.env
const CONFIG_PATH = '../../config'

describe('config', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...ORIGINAL_ENV,
      stage: 'mock-stage',
      CPX_REGION: 'mock-region',
      CPX_DB_USERNAME: 'mock-db-username',
      CPX_DB_PASSWORD: 'mock-db-password',
      CPX_DB_NAME: 'mock-db-name',
      CPX_DB_HOST: 'mock-db-host',
      CPX_AGW_URL: 'http://127.0.0.1'
    }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('accepts valid config', () => {
    expect(() => require(CONFIG_PATH)).not.toThrow()
    expect(console.log).toHaveBeenCalledWith('Config is valid')
  })

  it('rejects an invalid gateway URL', () => {
    process.env.CPX_AGW_URL = 'invalid URL'

    expect(() => require(CONFIG_PATH)).toThrow('Config validation failed')
  })

  it('rejects legacy configuration', () => {
    // Schema definition and validation live in the same module, so the schema
    // returned by Joi.object is wrapped to validate legacy settings instead.
    const Joi = require('joi')
    const originalObject = Joi.object
    jest.spyOn(Joi, 'object').mockImplementation(function (...args) {
      const schema = originalObject.apply(this, args)
      const originalValidate = schema.validate
      jest.spyOn(schema, 'validate').mockImplementation(function (_value, ...rest) {
        return originalValidate.call(this, {
          aws: {
            accessKeyId: 'mock access key ID',
            secretAccessKey: 'mock secret access key',
            accountId: 'mock account ID',
            sessionToken: 'mock session token',
            region: 'mock region',
            stage: 'mock',
            rdsConnectionString: 'mock RDS connection string'
          },
          url: 'mock url'
        }, ...rest)
      })
      return schema
    })

    expect(() => require(CONFIG_PATH)).toThrow('Config validation failed')
  })
})
