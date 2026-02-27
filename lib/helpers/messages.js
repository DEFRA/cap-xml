'use strict'
const service = require('./service')
const { validateXML } = require('xmllint-wasm')
const fs = require('node:fs')
const path = require('node:path')
const xsdSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'atom.xsd'), 'utf8')

module.exports.messages = async (v2 = false) => {
  console.log(`[getMessagesAtom] Generating atom feed, version: ${v2 ? 'v2' : 'v1'}`)
  const feedStart = Date.now()
  const { Feed } = await import('feed')
  const dbStart = Date.now()
  const ret = await service.getAllMessages()
  console.log(`[getMessagesAtom] Database query completed in ${Date.now() - dbStart}ms`)
  const messageCount = ret?.rows?.length || 0
  console.log(`[getMessagesAtom] Feed contains ${messageCount} messages`)
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

  const feedGenStart = Date.now()
  const xmlFeed = feed.atom1()
  console.log(`[getMessagesAtom] Feed generated in ${Date.now() - feedGenStart}ms, size: ${xmlFeed.length} bytes`)

  const validationResult = await validateXML({
    xml: [{
      fileName: 'atom-feed.xml',
      contents: xmlFeed
    }],
    schema: [xsdSchema]
  })
  // NI-95 log validation errors and continue processing
  if (validationResult.errors?.length > 0) {
    console.log('[getMessagesAtom] ATOM feed failed validation')
    console.log('[getMessagesAtom] Validation errors:', JSON.stringify(validationResult.errors))
  }

  console.log(`[getMessagesAtom] Total feed generation time: ${Date.now() - feedStart}ms`)
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    },
    body: xmlFeed
  }
}
