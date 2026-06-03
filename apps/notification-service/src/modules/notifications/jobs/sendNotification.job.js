/**
 * BullMQ job payload for `notification.send` queue.
 * @typedef {object} NotificationSendJobPayload
 * @property {string} tenantId
 * @property {string} userId
 * @property {string} type
 * @property {string} title
 * @property {string} body
 * @property {string} resourceType
 * @property {string} resourceId
 * @property {object} [metadata]
 * @property {string} [correlationId]
 * @property {object} [email]
 * @property {string} email.to
 * @property {string} [email.templateId]
 * @property {object} [email.templateData]
 * @property {string} [email.subject]
 */

/**
 * @param {NotificationSendJobPayload} data
 * @param {import('../services/NotificationDispatchService.js').default} dispatchService
 */
export async function processSendNotificationJob(data, dispatchService) {
  return dispatchService.dispatch(data);
}
