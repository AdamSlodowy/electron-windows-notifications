const xml = require('@nodert-win10/windows.data.xml.dom')
const notifications = require('@nodert-win10/windows.ui.notifications')
const EventEmitter = require('events')
const util = require('util')
const xmlEscape = require('xml-escape')

const { getAppId, log, getIsCentennial } = require('./utils')

/**
 * A notification similar to the native Windows ToastNotification.
 *
 * @class Notification
 * @extends {EventEmitter}
 */
class ToastNotification extends EventEmitter {
  /**
   * Creates an instance of ToastNotification.
   *
   * @param {object} options
   * @param {string} options.template
   * @param {string[]} options.strings
   * @param {Date} options.expirationTime
   * @param {string} options.group
   * @param {string} options.tag
   * @param {string} [options.appId]
   */
  constructor (options = {}) {
    super(...arguments)

    options.template = options.template || ''
    options.strings = options.strings || []
    options.appId = options.appId || getAppId()

    let strings = options.strings.map(v => xmlEscape(v))

    this.formattedXml = util.format(options.template, ...strings)
    let xmlDocument = new xml.XmlDocument()
    xmlDocument.loadXml(this.formattedXml)

    log(`Creating new toast notification`)
    log(this.formattedXml)

    this.toast = new notifications.ToastNotification(xmlDocument)
    // The event args object for the activated event is returned by the UWP API as a basic Object type, so we cast it to ToastActivatedEventArgs
    this.toast.on('activated', (t, e) => this.emit('activated', t, notifications.ToastActivatedEventArgs.castFrom(e)))
    this.toast.on('dismissed', (..._args) => this.emit('dismissed', ..._args))

    // Temporarily disabled
    // this.toast.on('failed', (..._args) => this.emit('failed', ..._args))

    if (options.expirationTime) this.toast.expirationTime = options.expirationTime
    if (options.group) this.toast.group = options.group
    if (options.tag) this.toast.tag = options.tag

    // Not present: surpressPopup. Why? From Microsoft:
    // Do not set this property to true in a toast sent to a Windows 8.x device.
    // Doing so will cause a compiler error or a dropped notification.

    this.notifier = getIsCentennial()
      ? notifications.ToastNotificationManager.createToastNotifier()
      : notifications.ToastNotificationManager.createToastNotifier(options.appId)
  }

  /**
   * Shows the toast notification. This will first check the static property `setting`
   * on the toast notifier to ensure that the notification can actually be sent.
   *
   * @memberOf Notification
   */
  show () {
    if (this.toast && this.notifier) {
      // But first, we check if we get to show one
      switch (this.notifier.setting) {
        case 0:
          // Everything is alright, let's show it
          this.notifier.show(this.toast)
          break
        case 1:
          // DisabledByManifest
          this.emit('failed', new Error('Notifications are disabled by app manifest.'))
          break
        case 2:
          // DisabledByGroupPolicy
          this.emit('failed', new Error('Notifications are disabled by Windows group policy.'))
          break
        case 3:
          // DisabledForUser
          this.emit('failed', new Error('Notifications are disabled for this user (system-wide).'))
          break
        case 4:
          // DisabledForApplication
          this.emit('failed', new Error('Notifications are disabled for this app only (in Windows settings).'))
          break
        default:
          this.notifier.show(this.toast)
      }
    }
  }

  /**
   * Hides the toast notification
   *
   * @memberOf Notification
   */
  hide () {
    if (this.toast && this.notifier) {
      this.notifier.hide(this.toast)
    }
  }
}

module.exports = ToastNotification
