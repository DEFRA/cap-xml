'use strict'

const service = require('../helpers/service')
const config = require('../../config/config.json')
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
    id: config.url + '/messages.atom',
    link: config.url + '/messages.atom',
    updated: new Date(),
    author: {
      name: 'Environment Agency',
      link: 'https://www.gov.uk/government/organisations/environment-agency'
    },
    copyright: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
  })

  if (!!ret && Array.isArray(ret.rows)) {
    ret.rows.forEach((item) => {
      feed.addItem({
        title: item.fwis_code,
        id: config.url + '/message/' + item.identifier,
        link: config.url + '/message/' + item.identifier,
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
