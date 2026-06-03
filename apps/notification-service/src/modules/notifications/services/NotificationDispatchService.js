import mongoose from 'mongoose';
import NotificationRepository from '../repositories/NotificationRepository.js';

/**
 * Processes queued notification jobs: in-app record + optional email.
 */
export default class NotificationDispatchService {
  constructor({
    notificationRepository = new NotificationRepository(),
    emailService,
    webUrl,
  }) {
    this.notificationRepository = notificationRepository;
    this.emailService = emailService;
    this.webUrl = webUrl;
  }

  async dispatch(payload) {
    const tenantId = new mongoose.Types.ObjectId(payload.tenantId);
    const userId = new mongoose.Types.ObjectId(payload.userId);
    const resourceId = new mongoose.Types.ObjectId(payload.resourceId);

    const notification = await this.notificationRepository.create({
      tenantId,
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      resourceType: payload.resourceType,
      resourceId,
      metadata: payload.metadata ?? {},
    });

    let emailResult = null;

    if (payload.email?.to) {
      const templateData = {
        ...payload.email.templateData,
        appUrl: payload.email.templateData?.appUrl ?? this.webUrl,
      };

      emailResult = await this.emailService.sendTemplatedEmail({
        tenantId,
        to: payload.email.to,
        templateId: payload.email.templateId ?? payload.type,
        templateData,
        subjectOverride: payload.email.subject,
      });
    }

    return {
      notificationId: String(notification._id),
      email: emailResult,
    };
  }
}
