import EmailOutbox from '../models/EmailOutbox.js';

export class EmailOutboxRepository {
  create(payload) {
    return EmailOutbox.create(payload);
  }

  markSent(id) {
    return EmailOutbox.findByIdAndUpdate(
      id,
      {
        $set: { status: 'sent', sentAt: new Date() },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
  }

  markFailed(id, errorMessage) {
    return EmailOutbox.findByIdAndUpdate(
      id,
      {
        $set: { status: 'failed', lastError: errorMessage?.slice(0, 2000) ?? 'Unknown error' },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
  }
}

export default EmailOutboxRepository;
