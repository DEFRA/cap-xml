const xmldom = require('@xmldom/xmldom')
const xmlFormat = require('xml-formatter')
const { Sql } = require('sql-ts')
const sql = new Sql('postgres')
const messages = sql.define({
  name: 'messages',
  columns: ['identifier', 'msg_type', 'references', 'alert', 'fwis_code', 'expires', 'sent', 'created']
})

class Message {
  constructor (xmlString) {
    this.doc = new xmldom.DOMParser().parseFromString(xmlString, 'text/xml')
  }

  get fwisCode () {
    return this.getFirstElement('geocode').getElementsByTagName('value')[0].textContent
  }

  get identifier () {
    return this.getFirstElement('identifier').textContent
  }

  get sender () {
    return this.getFirstElement('sender').textContent
  }

  get msgType () {
    return this.getFirstElement('msgType').textContent
  }

  set msgType (value) {
    this.getFirstElement('msgType').textContent = value
  }

  get references () {
    return this.getFirstElement('references') ? this.getFirstElement('references').textContent : ''
  }

  set references (value) {
    if (value) {
      if (this.references) {
        this.getFirstElement('references').textContent = value
      } else {
        this.addElement('scope', 'references', value)
      }
      if (this.msgType === 'Alert') {
        this.msgType = 'Update'
      }
    }
  }

  get status () {
    return this.getFirstElement('status').textContent
  }

  set status (value) {
    this.getFirstElement('status').textContent = value
  }

  get expires () {
    return this.getFirstElement('expires').textContent
  }

  get sent () {
    return this.getFirstElement('sent').textContent
  }

  getFirstElement (tagName) {
    return this.doc.getElementsByTagName(tagName)[0]
  }

  addElement (parentTag, elTag, elValue) {
    const parentEl = this.doc.getElementsByTagName(parentTag)[0]
    const newEl = this.doc.createElement(elTag)
    newEl.textContent = elValue
    return parentEl.parentNode.insertBefore(newEl, parentEl.nextSibling)
  }

  toString () {
    return xmlFormat(new xmldom.XMLSerializer().serializeToString(this.doc), { indentation: '  ', collapseContent: true })
  }

  putQuery () {
    const message = {
      identifier: this.identifier,
      msg_type: this.msgType,
      references: this.references,
      alert: this.toString(),
      fwis_code: this.fwisCode,
      expires: this.expires,
      sent: this.sent,
      created: new Date().toISOString()
    }
    return messages.insert(message).toQuery()
  }
}

module.exports = Message
