'use strict'

const service = require('../helpers/service')
const { Feed } = require('feed')

module.exports.getMessagesAtom = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }

  const ret = await service.getAllMessages()

  const feed = new Feed({
    title: 'Flood warnings for England',
    generator: 'Environment Agency CAP XML flood warnings',
    description: 'Flood warnings for England',
    id: `${process.env.CPX_AGW_URL}/messages.atom`,
    link: `${process.env.CPX_AGW_URL}/messages.atom`,
    updated: new Date(),
    author: {
      name: 'Environment Agency',
      email: 'enquiries@environment-agency.gov.uk',
      link: 'https://www.gov.uk/government/organisations/environment-agency'
    },
    copyright: 'Copyright, Environment Agency. Licensed under Creative Commons BY 4.0'
  })

  if (!!ret && Array.isArray(ret.rows)) {
    ret.rows.forEach((item) => {
      feed.addItem({
        title: item.fwis_code,
        id: `${process.env.CPX_AGW_URL}/message/${item.identifier}`,
        link: `${process.env.CPX_AGW_URL}/message/${item.identifier}`,
        author: {
          name: 'Environment Agency',
          email: 'enquiries@environment-agency.gov.uk',
          link: 'https://www.gov.uk/government/organisations/environment-agency'
        },
        date: item.sent
      })
    })
  }

  response.body = feed.atom1()
  return response
}
