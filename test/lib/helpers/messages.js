'use strict'

const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const { messages } = require('../../../lib/helpers/messages')
const service = require('../../../lib/helpers/service')
let CPX_AGW_URL

lab.experiment('messages helper', () => {
  lab.before(() => {
    CPX_AGW_URL = process.env.CPX_AGW_URL
    process.env.CPX_AGW_URL = 'http://localhost:3000'
  })

  lab.after(() => {
    process.env.CPX_AGW_URL = CPX_AGW_URL
  })

  lab.experiment('messages v1 (v2=false)', () => {
    lab.beforeEach(() => {
      // mock database query
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve({
            rows: [{
              fwis_code: 'test_fwis_code',
              alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
              sent: new Date(),
              identifier: '4eb3b7350ab7aa443650fc9351f'
            }]
          })
        })
      }
    })

    lab.test('Returns v1 atom feed with correct URLs', async () => {
      const ret = await messages(false)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      Code.expect(ret.body).to.contain('<id>http://localhost:3000/messages.atom</id>')
      Code.expect(ret.body).to.contain('<id>http://localhost:3000/message/4eb3b7350ab7aa443650fc9351f</id>')
      Code.expect(ret.body).to.not.contain('/v2/')
    })

    lab.test('Handles bad rows returned', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve({
            rows: 1
          })
        })
      }
      const ret = await messages(false)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
    })

    lab.test('Handles no return from database', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve()
        })
      }
      const ret = await messages(false)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
    })

    lab.test('Throws error on database failure', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          reject(new Error('test error'))
        })
      }
      const err = await Code.expect(messages(false)).to.reject()
      Code.expect(err.message).to.equal('test error')
    })

    lab.test('Includes feed metadata', async () => {
      const ret = await messages(false)
      Code.expect(ret.body).to.contain('<title>Flood warnings for England</title>')
      Code.expect(ret.body).to.contain('<generator>Environment Agency CAP XML flood warnings</generator>')
      Code.expect(ret.body).to.contain('<name>Environment Agency</name>')
      Code.expect(ret.body).to.contain('<email>enquiries@environment-agency.gov.uk</email>')
    })

    lab.test('Includes entry for each message', async () => {
      service.getAllMessages = () => {
        return Promise.resolve({
          rows: [
            {
              fwis_code: 'AREA1',
              alert: '<alert>test1</alert>',
              sent: new Date('2025-01-01'),
              identifier: 'id1'
            },
            {
              fwis_code: 'AREA2',
              alert: '<alert>test2</alert>',
              sent: new Date('2025-01-02'),
              identifier: 'id2'
            }
          ]
        })
      }
      const ret = await messages(false)
      Code.expect(ret.body).to.contain('<title type="html"><![CDATA[AREA1]]></title>')
      Code.expect(ret.body).to.contain('<title type="html"><![CDATA[AREA2]]></title>')
      Code.expect(ret.body).to.contain('http://localhost:3000/message/id1')
      Code.expect(ret.body).to.contain('http://localhost:3000/message/id2')
    })
  })

  lab.experiment('messages v2 (v2=true)', () => {
    lab.beforeEach(() => {
      // mock database query
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve({
            rows: [{
              fwis_code: 'test_fwis_code',
              alert: '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">test</alert>',
              sent: new Date(),
              identifier: '4eb3b7350ab7aa443650fc9351f',
              identifier_v2: '2.49.0.1.826.1.YYYYMMDDHHMMSS.4eb3b7350ab7aa443650fc9351f'
            }]
          })
        })
      }
    })

    lab.test('Returns v2 atom feed with correct URLs', async () => {
      const ret = await messages(true)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
      Code.expect(ret.body).to.contain('<id>http://localhost:3000/v2/messages.atom</id>')
      Code.expect(ret.body).to.contain('<id>http://localhost:3000/v2/message/4eb3b7350ab7aa443650fc9351f</id>')
    })

    lab.test('Handles bad rows returned', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve({
            rows: 1
          })
        })
      }
      const ret = await messages(true)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
    })

    lab.test('Handles no return from database', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve()
        })
      }
      const ret = await messages(true)
      Code.expect(ret.statusCode).to.equal(200)
      Code.expect(ret.headers['content-type']).to.equal('application/xml')
    })

    lab.test('Throws error on database failure', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          reject(new Error('test error'))
        })
      }
      const err = await Code.expect(messages(true)).to.reject()
      Code.expect(err.message).to.equal('test error')
    })

    lab.test('Includes feed metadata', async () => {
      const ret = await messages(true)
      Code.expect(ret.body).to.contain('<title>Flood warnings for England</title>')
      Code.expect(ret.body).to.contain('<generator>Environment Agency CAP XML flood warnings</generator>')
      Code.expect(ret.body).to.contain('<name>Environment Agency</name>')
      Code.expect(ret.body).to.contain('<email>enquiries@environment-agency.gov.uk</email>')
    })

    lab.test('Includes entry for each message', async () => {
      service.getAllMessages = () => {
        return Promise.resolve({
          rows: [
            {
              fwis_code: 'AREA1',
              alert: '<alert>test1</alert>',
              sent: new Date('2025-01-01'),
              identifier: 'id1',
              identifier_v2: '2.49.0.1.826.1.20250101000000.id1'
            },
            {
              fwis_code: 'AREA2',
              alert: '<alert>test2</alert>',
              sent: new Date('2025-01-02'),
              identifier: 'id2',
              identifier_v2: '2.49.0.1.826.1.20250102000000.id2'
            }
          ]
        })
      }
      const ret = await messages(true)
      Code.expect(ret.body).to.contain('<title type="html"><![CDATA[AREA1]]></title>')
      Code.expect(ret.body).to.contain('<title type="html"><![CDATA[AREA2]]></title>')
      Code.expect(ret.body).to.contain('http://localhost:3000/v2/message/id1')
      Code.expect(ret.body).to.contain('http://localhost:3000/v2/message/id2')
    })
  })

  lab.experiment('Edge cases and behavior differences', () => {
    lab.beforeEach(() => {
      service.getAllMessages = () => {
        return Promise.resolve({
          rows: [{
            fwis_code: 'TEST_CODE',
            alert: '<alert>test</alert>',
            sent: new Date('2025-01-01T12:00:00Z'),
            identifier: 'test_id',
            identifier_v2: '2.49.0.1.826.1.20250101120000.test_id'
          }]
        })
      }
    })

    lab.test('V1 and V2 feeds have different URI prefixes', async () => {
      const retV1 = await messages(false)
      const retV2 = await messages(true)

      Code.expect(retV1.body).to.contain('http://localhost:3000/messages.atom')
      Code.expect(retV1.body).to.not.contain('/v2/')

      Code.expect(retV2.body).to.contain('http://localhost:3000/v2/messages.atom')
      Code.expect(retV2.body).to.contain('/v2/message/')
    })

    lab.test('Both v1 and v2 return same status code and headers', async () => {
      const retV1 = await messages(false)
      const retV2 = await messages(true)

      Code.expect(retV1.statusCode).to.equal(retV2.statusCode)
      Code.expect(retV1.headers).to.equal(retV2.headers)
    })

    lab.test('Empty database returns valid empty feed for both versions', async () => {
      service.getAllMessages = () => Promise.resolve({ rows: [] })

      const retV1 = await messages(false)
      const retV2 = await messages(true)

      Code.expect(retV1.statusCode).to.equal(200)
      Code.expect(retV2.statusCode).to.equal(200)
      Code.expect(retV1.body).to.contain('<feed')
      Code.expect(retV2.body).to.contain('<feed')
    })

    lab.test('Both versions handle multiple messages correctly', async () => {
      service.getAllMessages = () => {
        return Promise.resolve({
          rows: Array.from({ length: 5 }, (_, i) => ({
            fwis_code: `AREA${i}`,
            alert: `<alert>test${i}</alert>`,
            sent: new Date(`2025-01-0${i + 1}`),
            identifier: `id${i}`,
            identifier_v2: `2.49.0.1.826.1.2025010${i + 1}000000.id${i}`
          }))
        })
      }

      const retV1 = await messages(false)
      const retV2 = await messages(true)

      for (let i = 0; i < 5; i++) {
        Code.expect(retV1.body).to.contain(`<title type="html"><![CDATA[AREA${i}]]></title>`)
        Code.expect(retV2.body).to.contain(`<title type="html"><![CDATA[AREA${i}]]></title>`)
      }
    })
  })
})
