import { getMailTransporter } from '../../../infrastructure/email/transporter.js';
import { renderEmailTemplate } from '../../../infrastructure/email/templates.js';
import EmailOutboxRepository from '../repositories/EmailOutboxRepository.js';

export default class EmailService {
  constructor({ smtp, emailFrom, emailFromName, outboxRepository = new EmailOutboxRepository() }) {
    this.smtp = smtp;
    this.emailFrom = emailFrom;
    this.emailFromName = emailFromName;
    this.outboxRepository = outboxRepository;
  }

  /**
   * Send email via Nodemailer; persist outbox record for audit/retry.
   */
  async sendTemplatedEmail({
    tenantId,
    to,
    templateId,
    templateData,
    subjectOverride,
  }) {
    const rendered = renderEmailTemplate(templateId, templateData);
    const subject = subjectOverride ?? rendered.subject;

    const outbox = await this.outboxRepository.create({
      tenantId: tenantId ?? null,
      to,
      templateId,
      templateData,
      subject,
      status: 'pending',
    });

    try {
      const transporter = getMailTransporter(this.smtp);

      await transporter.sendMail({
        from: `"${this.emailFromName}" <${this.emailFrom}>`,
        to,
        subject,
        text: rendered.text,
        html: rendered.html,
      });

      await this.outboxRepository.markSent(outbox._id);

      return { outboxId: outbox._id, status: 'sent' };
    } catch (error) {
      await this.outboxRepository.markFailed(outbox._id, error.message);
      throw error;
    }
  }
}
