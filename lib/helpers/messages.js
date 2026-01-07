'use strict'
const service = require('./service')
const { validateXML } = require('xmllint-wasm')
const fs = require('node:fs')
const path = require('node:path')
const xsdSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'atom.xsd'), 'utf8')

module.exports.messages = async (v2 = false) => {
  const { Feed } = await import('feed')
  const ret = await service.getAllMessages()
  const uriPrefix = v2 ? '/v2' : ''

  const feed = new Feed({
    title: 'Flood warnings for England',
    generator: 'Environment Agency CAP XML flood warnings',
    description: 'Flood warnings for England',
    id: `${process.env.CPX_AGW_URL}${uriPrefix}/messages.atom`,
    link: `${process.env.CPX_AGW_URL}${uriPrefix}/messages.atom`,
    updated: new Date(),
    author: {
      name: 'Environment Agency',
      email: 'enquiries@environment-agency.gov.uk',
      link: 'https://www.gov.uk/government/organisations/environment-agency'
    },
    copyright: 'Copyright, Environment Agency. Licensed under Creative Commons BY 4.0'
  })

  if (!!ret && Array.isArray(ret.rows)) {
    for (const item of ret.rows) {
      feed.addItem({
        title: item.fwis_code,
        id: `${process.env.CPX_AGW_URL}${uriPrefix}/message/${item.identifier}`,
        link: `${process.env.CPX_AGW_URL}${uriPrefix}/message/${item.identifier}`,
        author: {
          name: 'Environment Agency',
          email: 'enquiries@environment-agency.gov.uk',
          link: 'https://www.gov.uk/government/organisations/environment-agency'
        },
        date: item.sent
      })
    }
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
