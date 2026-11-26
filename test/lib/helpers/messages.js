'use strict'

const { messages } = require('../../../lib/helpers/messages')
const service = require('../../../lib/helpers/service')
let CPX_AGW_URL

describe('messages helper', () => {
  beforeAll(() => {
    CPX_AGW_URL = process.env.CPX_AGW_URL
    process.env.CPX_AGW_URL = 'http://localhost:3000'
  })

  afterAll(() => {
    process.env.CPX_AGW_URL = CPX_AGW_URL
  })

  describe('messages v1 (v2=false)', () => {
    beforeEach(() => {
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

    it('Returns v1 atom feed with correct URLs', async () => {
      const ret = await messages(false)
      expect(ret.statusCode).toBe(200)
      expect(ret.headers['content-type']).toBe('application/xml')
      expect(ret.body).toContain('<id>http://localhost:3000/messages.atom</id>')
      expect(ret.body).toContain('<id>http://localhost:3000/message/4eb3b7350ab7aa443650fc9351f</id>')
      expect(ret.body).not.toContain('/v2/')
    })

    it('Handles bad rows returned', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve({
            rows: 1
          })
        })
      }
      const ret = await messages(false)
      expect(ret.statusCode).toBe(200)
      expect(ret.headers['content-type']).toBe('application/xml')
    })

    it('Handles no return from database', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve()
        })
      }
      const ret = await messages(false)
      expect(ret.statusCode).toBe(200)
      expect(ret.headers['content-type']).toBe('application/xml')
    })

    it('Throws error on database failure', async () => {
      jest.spyOn(service, 'getAllMessages').mockRejectedValue(new Error('test error'))
      await expect(messages(false)).rejects.toThrow('test error')
    })

    it('Includes feed metadata', async () => {
      const ret = await messages(false)
      expect(ret.body).toContain('<title>Flood warnings for England</title>')
      expect(ret.body).toContain('<generator>Environment Agency CAP XML flood warnings</generator>')
      expect(ret.body).toContain('<name>Environment Agency</name>')
      expect(ret.body).toContain('<email>enquiries@environment-agency.gov.uk</email>')
    })

    it('Includes entry for each message', async () => {
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
      expect(ret.body).toContain('<title type="html"><![CDATA[AREA1]]></title>')
      expect(ret.body).toContain('<title type="html"><![CDATA[AREA2]]></title>')
      expect(ret.body).toContain('http://localhost:3000/message/id1')
      expect(ret.body).toContain('http://localhost:3000/message/id2')
    })
  })

  describe('messages v2 (v2=true)', () => {
    beforeEach(() => {
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

    it('Returns v2 atom feed with correct URLs', async () => {
      const ret = await messages(true)
      expect(ret.statusCode).toBe(200)
      expect(ret.headers['content-type']).toBe('application/xml')
      expect(ret.body).toContain('<id>http://localhost:3000/v2/messages.atom</id>')
      expect(ret.body).toContain('<id>http://localhost:3000/v2/message/4eb3b7350ab7aa443650fc9351f</id>')
    })

    it('Handles bad rows returned', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve({
            rows: 1
          })
        })
      }
      const ret = await messages(true)
      expect(ret.statusCode).toBe(200)
      expect(ret.headers['content-type']).toBe('application/xml')
    })

    it('Handles no return from database', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          resolve()
        })
      }
      const ret = await messages(true)
      expect(ret.statusCode).toBe(200)
      expect(ret.headers['content-type']).toBe('application/xml')
    })

    it('Throws error on database failure', async () => {
      service.getAllMessages = (query) => {
        return new Promise((resolve, reject) => {
          reject(new Error('test error'))
        })
      }
      await expect(messages(true)).rejects.toThrow('test error')
    })

    it('Includes feed metadata', async () => {
      const ret = await messages(true)
      expect(ret.body).toContain('<title>Flood warnings for England</title>')
      expect(ret.body).toContain('<generator>Environment Agency CAP XML flood warnings</generator>')
      expect(ret.body).toContain('<name>Environment Agency</name>')
      expect(ret.body).toContain('<email>enquiries@environment-agency.gov.uk</email>')
    })

    it('Includes entry for each message', async () => {
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
      expect(ret.body).toContain('<title type="html"><![CDATA[AREA1]]></title>')
      expect(ret.body).toContain('<title type="html"><![CDATA[AREA2]]></title>')
      expect(ret.body).toContain('http://localhost:3000/v2/message/id1')
      expect(ret.body).toContain('http://localhost:3000/v2/message/id2')
    })
  })

  describe('Edge cases and behavior differences', () => {
    beforeEach(() => {
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

    it('V1 and V2 feeds have different URI prefixes', async () => {
      const retV1 = await messages(false)
      const retV2 = await messages(true)

      expect(retV1.body).toContain('http://localhost:3000/messages.atom')
      expect(retV1.body).not.toContain('/v2/')

      expect(retV2.body).toContain('http://localhost:3000/v2/messages.atom')
      expect(retV2.body).toContain('/v2/message/')
    })

    it('Both v1 and v2 return same status code and headers', async () => {
      const retV1 = await messages(false)
      const retV2 = await messages(true)

      expect(retV1.statusCode).toBe(retV2.statusCode)
      expect(retV1.headers).toEqual(retV2.headers)
    })

    it('Empty database returns valid empty feed for both versions', async () => {
      service.getAllMessages = () => Promise.resolve({ rows: [] })

      const retV1 = await messages(false)
      const retV2 = await messages(true)

      expect(retV1.statusCode).toBe(200)
      expect(retV2.statusCode).toBe(200)
      expect(retV1.body).toContain('<feed')
      expect(retV2.body).toContain('<feed')
    })

    it('Both versions handle multiple messages correctly', async () => {
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
        expect(retV1.body).toContain(`<title type="html"><![CDATA[AREA${i}]]></title>`)
        expect(retV2.body).toContain(`<title type="html"><![CDATA[AREA${i}]]></title>`)
      }
    })
  })
})
