const db = require('./database')
const queries = require('./queries')

module.exports = {
  getMessage: (id) => {
    return db.query(queries.getMessage, [id])
  },
  getLastMessage: (id) => {
    return db.query(queries.getLastMessage, [id])
  },
  getAllMessages: () => {
    return db.query(queries.getAllMessages)
  },
  putMessage: (query) => {
    return db.query(query)
  },
  archiveMessages: () => {
    return db.query(queries.archiveMessages)
  }
}
