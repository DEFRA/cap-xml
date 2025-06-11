const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const sinon = require('sinon')
const Joi = require('joi')

const ORIGINAL_ENV = process.env

lab.experiment('Config test', () => {
  lab.beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.stage = 'dummy stage'
    process.env.CPX_REGION = 'dummy region'
    process.env.CPX_DB_USERNAME = 'dummy db username'
    process.env.CPX_DB_PASSWORD = 'dummy db password'
    process.env.CPX_DB_NAME = 'dummy db name'
    process.env.CPX_DB_HOST = 'dummy db host'
    process.env.CPX_AGW_URL = 'http://127.0.0.1'
  })

  lab.afterEach(() => {
    delete require.cache[require.resolve('../../config')]
    sinon.restore()
  })

  lab.test('Check valid config passes', () => {
    Code.expect(() => { require('../../config') }).not.to.throw()
  })

  lab.test('Check bad config fails', () => {
    process.env.CPX_AGW_URL = 'invalid URL'
    Code.expect(() => { require('../../config') }).to.throw()
  })

  lab.test('Legacy configuration is rejected', () => {
    // As configuration schema definition and validation are part of the same module,
    // validation of the schema returned by Joi.object is stubbed so that legacy
    // configuration settings can be provided and tested for expected rejection.
    // Ideally, this test would be able to stub Joi validation directly without
    // needing to stub the validate method of the schema returned by Joi.object.
    // At the time of writing, a way to do this without refactoring the software under
    // test into two modules for stubbing purposes has not been found.
    sinon.stub(Joi, 'object').callsFake(function (...args) {
      // Call the original Joi.object function so that the validate method of the
      // returned schema object can be stubbed.
      const schema = Joi.object.wrappedMethod.apply(this, args)
      sinon.stub(schema, 'validate').callsFake(function (...innerArgs) {
        innerArgs[0] = {
          aws: {
            accessKeyId: 'dummy access key ID',
            secretAccessKey: 'dummy secret access key',
            accountId: 'dummy account ID',
            sessionToken: 'dummy session token',
            region: 'dummy region',
            stage: 'dummy',
            rdsConnectionString: 'dummy RDSconnection string'
          },
          url: 'dummy url'
        }
        return schema.validate.wrappedMethod.apply(this, innerArgs)
      })
      return schema
    })
    Code.expect(() => { require('../../config') }).to.throw()
  })
})
