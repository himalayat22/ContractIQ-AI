import mongoose from 'mongoose';
import { AppError } from '../../../utils/AppError.js';
import NotificationRepository from '../repositories/NotificationRepository.js';

function toDto(doc) {
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    resourceType: doc.resourceType,
    resourceId: String(doc.resourceId),
    read: doc.read,
    readAt: doc.readAt?.toISOString?.() ?? doc.readAt ?? null,
    createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt,
  };
}

export default class NotificationService {
  constructor(repository = new NotificationRepository()) {
    this.repository = repository;
  }

  async listForUser({ tenantId, userId, read, type, page, limit }) {
    const { items, total } = await this.repository.list({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(userId),
      read,
      type,
      page,
      limit,
    });

    return {
      data: items.map(toDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUnreadCount(tenantId, userId) {
    const count = await this.repository.countUnread(
      new mongoose.Types.ObjectId(tenantId),
      new mongoose.Types.ObjectId(userId),
    );
    return { count };
  }

  async markRead({ tenantId, userId, notificationId }) {
    const updated = await this.repository.markRead(
      notificationId,
      new mongoose.Types.ObjectId(tenantId),
      new mongoose.Types.ObjectId(userId),
    );

    if (!updated) {
      throw new AppError('Notification not found', {
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return {
      id: String(updated._id),
      read: updated.read,
      readAt: updated.readAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  async markAllRead(tenantId, userId) {
    const result = await this.repository.markAllRead(
      new mongoose.Types.ObjectId(tenantId),
      new mongoose.Types.ObjectId(userId),
    );
    return { markedCount: result.modifiedCount ?? 0 };
  }
}
