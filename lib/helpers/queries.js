'use strict'

module.exports = {
  getMessage: 'select cx.getMessage($1);',
  getLastMessage: 'select * from cx.messages where fwis_code = $1 order by created desc limit 1;',
  getAllMessages: 'select * from cx.getAllMessages();',
  archiveMessages: 'select cx.archiveMessages();'
}
