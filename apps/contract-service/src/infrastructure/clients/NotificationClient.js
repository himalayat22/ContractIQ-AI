export class NotificationClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl
   * @param {string} [options.internalApiKey]
   */
  constructor({ baseUrl, internalApiKey }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.internalApiKey = internalApiKey;
  }

  /**
   * @param {object} payload
   * @param {string} payload.tenantId
   * @param {string} payload.userId
   * @param {string} payload.contractId
   * @param {'analysis_complete' | 'analysis_failed'} payload.type
   * @param {string} payload.title
   * @param {string} payload.body
   * @param {string} [payload.correlationId]
   * @param {object} [payload.metadata]
   */
  async sendAnalysisNotification(payload) {
    const url = `${this.baseUrl}/api/v1/internal/notify`;
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.internalApiKey) {
      headers['X-Internal-Api-Key'] = this.internalApiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId: payload.tenantId,
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        resourceType: 'contract',
        resourceId: payload.contractId,
        metadata: payload.metadata,
        correlationId: payload.correlationId,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Notification service returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      );
    }

    return response.json();
  }
}

export default NotificationClient;
