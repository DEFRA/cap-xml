'use strict'

module.exports = {
  getMessage: 'select * from cx.messages where identifier = $1 order by created desc limit 1;',
  getLastMessage: 'select * from cx.messages where fwis_code = $1 order by created desc limit 1;',
  getAllMessages: 'select * from cx.getAllMessages();'
}
