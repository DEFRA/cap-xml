const xmldom = require('@xmldom/xmldom')
const xmlFormat = require('xml-formatter')
const { Sql } = require('sql-ts')
const sql = new Sql('postgres')
const messages = sql.define({
  name: 'messages',
  columns: ['identifier', 'msg_type', 'references', 'alert', 'fwis_code', 'expires', 'sent', 'created', 'identifier_v2', 'references_v2', 'alert_v2']
})

class Message {
  constructor (xmlString) {
    this.doc = new xmldom.DOMParser().parseFromString(xmlString, 'text/xml')
  }

  get fwisCode () {
    return this.getFirstElement('geocode')?.getElementsByTagName('value')[0].textContent || ''
  }

  get identifier () {
    return this.getFirstElement('identifier')?.textContent || ''
  }

  set identifier (value) {
    this.getFirstElement('identifier').textContent = value
  }

  get sender () {
    return this.getFirstElement('sender')?.textContent || ''
  }

  get msgType () {
    return this.getFirstElement('msgType')?.textContent || ''
  }

  set msgType (value) {
    this.getFirstElement('msgType').textContent = value
  }

  get references () {
    return this.getFirstElement('references')?.textContent || ''
  }

  set references (value) {
    const referencesEl = this.getFirstElement('references')
    if (referencesEl) {
      referencesEl.textContent = value
    } else {
      this.addElement('scope', 'references', value)
    }
    if (this.msgType === 'Alert') {
      this.msgType = 'Update'
    }
  }

  get status () {
    return this.getFirstElement('status')?.textContent || ''
  }

  set status (value) {
    this.getFirstElement('status').textContent = value
  }

  get expires () {
    return this.getFirstElement('expires')?.textContent || ''
  }

  get sent () {
    return this.getFirstElement('sent')?.textContent || ''
  }

  get code () {
    return this.getFirstElement('code')?.textContent || ''
  }

  set code (value) {
    const codeEl = this.getFirstElement('code')
    if (codeEl) {
      codeEl.textContent = value
    } else {
      this.addElement('scope', 'code', value)
    }
  }

  get event () {
    return this.getFirstElement('event')?.textContent || ''
  }

  set event (value) {
    this.getFirstElement('event').textContent = value
  }

  get severity () {
    return this.getFirstElement('severity')?.textContent || ''
  }

  set severity (value) {
    this.getFirstElement('severity').textContent = value
  }

  get onset () {
    return this.getFirstElement('onset')?.textContent || ''
  }

  set onset (value) {
    const onsetEl = this.getFirstElement('onset')
    if (onsetEl) {
      onsetEl.textContent = value
    } else {
      this.addElement('certainty', 'onset', value)
    }
  }

  get headline () {
    return this.getFirstElement('headline')?.textContent || ''
  }

  set headline (value) {
    const headlineEl = this.getFirstElement('headline')
    if (headlineEl) {
      headlineEl.textContent = value
    } else {
      this.addElement('senderName', 'headline', value)
    }
  }

  get areaDesc () {
    return this.getFirstElement('areaDesc')?.textContent || ''
  }

  get quickdialNumber () {
    return this.getFirstElement('instruction')?.textContent.match(/quickdial code:\s*(\d{6})\./i)?.[1] || ''
  }

  get instruction () {
    return this.getFirstElement('instruction')?.textContent || ''
  }

  set instruction (value) {
    const instruction = this.doc.getElementsByTagName('instruction')[0]
    const newCData = this.doc.createCDATASection(value)
    if (instruction) {
      while (instruction.firstChild) {
        instruction.removeChild(instruction.firstChild)
      }
      instruction.appendChild(newCData)
    } else {
      this.addElement('description', 'instruction', '').appendChild(newCData)
    }
  }

  getFirstElement (tagName) {
    return this.doc.getElementsByTagName(tagName)[0]
  }

  addElement (afterTag, elTag, elValue) {
    const afterTagEl = this.doc.getElementsByTagName(afterTag)[0]
    const newEl = this.doc.createElement(elTag)
    newEl.textContent = elValue
    return afterTagEl.parentNode.insertBefore(newEl, afterTagEl.nextSibling)
  }

  addParameter (name, value) {
    const infoEl = this.doc.getElementsByTagName('info')[0]
    const areaEl = infoEl.getElementsByTagName('area')[0]
    const parameterEl = this.doc.createElement('parameter')
    const valueNameEl = this.doc.createElement('valueName')
    const valueEl = this.doc.createElement('value')
    valueNameEl.textContent = name
    valueEl.textContent = value
    parameterEl.appendChild(valueNameEl)
    parameterEl.appendChild(valueEl)
    if (areaEl) {
      return infoEl.insertBefore(parameterEl, areaEl)
    } else {
      return infoEl.appendChild(parameterEl)
    }
  }

  toString () {
    return xmlFormat(new xmldom.XMLSerializer().serializeToString(this.doc), { indentation: '  ', collapseContent: true })
  }

  // Handles multiple message versions to create the single database record
  putQuery (messageV1, messageV2) {
    const message = {
      identifier: messageV1.identifier,
      msg_type: messageV1.msgType,
      references: messageV1.references,
      alert: messageV1.toString(),
      fwis_code: messageV1.fwisCode,
      expires: messageV1.expires,
      sent: messageV1.sent,
      created: new Date().toISOString(),
      identifier_v2: messageV2.identifier,
      references_v2: messageV2.references,
      alert_v2: messageV2.toString()
    }
    return messages.insert(message).toQuery()
  }
}

module.exports = Message
