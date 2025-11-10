'use strict'

const service = require('../helpers/service')
const { validateXML } = require('xmllint-wasm')
const fs = require('fs')
const path = require('path')
const xsdSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'atom.xsd'), 'utf8')

module.exports.getMessagesAtom = async (event) => {
  const { Feed } = await import('feed')

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

  const xmlFeed = feed.atom1()

  const validationResult = await validateXML({
    xml: [{
      fileName: 'atom-feed.xml',
      contents: xmlFeed
    }],
    schema: [xsdSchema]
  })
  // NI-95 log validation errors and continue processing
  if (validationResult.errors?.length > 0) {
    console.log('ATOM feed failed validation')
    console.log(JSON.stringify(validationResult.errors))
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    },
    body: xmlFeed
  }
}
