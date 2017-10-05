'use strict'

module.exports = {
  getMessage: 'select * from cx.messages where identifier = $1;',
  getLastMessage: 'select * from cx.messages where fwis_code = $1 order by created desc limit 1;',
  getAllMessages: 'select * from cx.messages m inner join (select distinct on (fwis_code) id from cx.messages order by fwis_code, created desc) as l on l.id = m.id where m.expires > now()::timestamp order by m.created desc;'
}
