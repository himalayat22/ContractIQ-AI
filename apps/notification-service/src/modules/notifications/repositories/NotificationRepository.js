import Notification from '../models/Notification.js';

export class NotificationRepository {
  create(payload) {
    return Notification.create(payload);
  }

  async list({ tenantId, userId, read, type, page, limit }) {
    const filter = { tenantId, userId };
    if (read === true || read === false) {
      filter.read = read;
    }
    if (type) {
      filter.type = type;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);

    return { items, total };
  }

  countUnread(tenantId, userId) {
    return Notification.countDocuments({ tenantId, userId, read: false });
  }

  markRead(id, tenantId, userId) {
    return Notification.findOneAndUpdate(
      { _id: id, tenantId, userId, read: false },
      { $set: { read: true, readAt: new Date() } },
      { new: true },
    ).lean();
  }

  markAllRead(tenantId, userId) {
    return Notification.updateMany(
      { tenantId, userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
  }
}

export default NotificationRepository;
