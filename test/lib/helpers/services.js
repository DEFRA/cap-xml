'use strict'

const db = require('../../../lib/helpers/database')
const service = require('../../../lib/helpers/service')

describe('service helper', () => {
  let querySpy

  beforeEach(() => {
    querySpy = jest.spyOn(db, 'query')
  })

  it('getMessage calls db.query with the correct query and id', async () => {
    const fakeResult = { rows: [{ id: 1, fwis_code: 'mock-fwis-code' }] }
    querySpy.mockResolvedValue(fakeResult)

    await expect(service.getMessage(1)).resolves.toEqual(fakeResult)
    expect(querySpy).toHaveBeenCalledExactlyOnceWith('select cx.getMessage($1);', [1])
  })

  it('getLastMessage calls db.query with the correct query and id', async () => {
    const fakeResult = { rows: [{ id: 2, fwis_code: 'mock-fwis-code' }] }
    querySpy.mockResolvedValue(fakeResult)

    await expect(service.getLastMessage(2)).resolves.toEqual(fakeResult)
    expect(querySpy).toHaveBeenCalledExactlyOnceWith('select * from cx.messages where fwis_code = $1 order by created desc limit 1;', [2])
  })

  it('getAllMessages calls db.query with the correct query', async () => {
    const fakeResult = { rows: [] }
    querySpy.mockResolvedValue(fakeResult)

    await expect(service.getAllMessages()).resolves.toEqual(fakeResult)
    expect(querySpy).toHaveBeenCalledExactlyOnceWith('select * from cx.getAllMessages();')
  })

  it('putMessage calls db.query with the provided query', async () => {
    const customQuery = 'INSERT INTO messages (fwis_code) VALUES (\'mock-fwis-code\')'
    const fakeResult = { rowCount: 1 }
    querySpy.mockResolvedValue(fakeResult)

    await expect(service.putMessage(customQuery)).resolves.toEqual(fakeResult)
    expect(querySpy).toHaveBeenCalledExactlyOnceWith(customQuery)
  })

  it('archiveMessages calls db.query with the correct query', async () => {
    const fakeResult = { rowCount: 5 }
    querySpy.mockResolvedValue(fakeResult)

    await expect(service.archiveMessages()).resolves.toEqual(fakeResult)
    expect(querySpy).toHaveBeenCalledExactlyOnceWith('select cx.archiveMessages();')
  })
})
