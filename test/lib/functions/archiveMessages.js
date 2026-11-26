'use strict'

const service = require('../../../lib/helpers/service')
const { archiveMessages } = require('../../../lib/functions/archiveMessages')

describe('archiveMessages', () => {
  it('calls service.archiveMessages', async () => {
    const archiveSpy = jest.spyOn(service, 'archiveMessages').mockResolvedValue()

    await archiveMessages()

    expect(archiveSpy).toHaveBeenCalledOnce()
  })

  it('propagates errors from service.archiveMessages', async () => {
    jest.spyOn(service, 'archiveMessages').mockRejectedValue(new Error('DB failure'))

    await expect(archiveMessages()).rejects.toThrow('DB failure')
  })
})
