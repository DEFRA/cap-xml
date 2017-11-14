'use strict'

const database = require('../helpers/database')
const queries = require('../helpers/queries')
const config = require('../../config/config.json')
const Feed = require('feed')

module.exports.getMessagesAtom = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/xml'
    }
  }
  // This allows for the postgres connection to be kept alive, otherwise callback doesn't kill function and it times out
  context.callbackWaitsForEmptyEventLoop = false

  // no validation as no inputs

  database.query(queries.getAllMessages, (err, ret) => {
    if (err) {
      return callback(err)
    }
    let feed = new Feed({
      title: 'Flood warnings for England',
      generator: 'Environment Agency CAP XML flood warnings',
      description: 'Flood warnings for England',
      id: config.url + '/messages.atom',
      link: config.url + '/messages.atom',
      updated: new Date(),
      author: {
        name: 'Environment Agency',
        link: 'https://www.gov.uk/government/organisations/environment-agency'
      }
    })

    ret.rows.forEach((item) => {
      feed.addItem({
        title: item.fwis_code,
        id: config.url + '/message/' + item.identifier,
        link: config.url + '/message/' + item.identifier,
        author: {
          name: 'Environment Agency',
          link: 'https://www.gov.uk/government/organisations/environment-agency'
        },
        date: item.sent
      })
    })
    response.body = feed.atom1()
    return callback(null, response)
  })
}
