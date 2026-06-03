import mongoose from 'mongoose';

const { Schema } = mongoose;

export const NOTIFICATION_TYPES = [
  'analysis_complete',
  'analysis_failed',
  'high_risk',
  'mention',
  'task_assigned',
  'member_invited',
  'member_joined',
];

export const RESOURCE_TYPES = ['contract', 'member', 'task'];

const notificationSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      required: [true, 'tenantId is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'userId is required'],
    },
    type: {
      type: String,
      required: [true, 'type is required'],
      enum: {
        values: NOTIFICATION_TYPES,
        message: `type must be one of: ${NOTIFICATION_TYPES.join(', ')}`,
      },
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: [true, 'body is required'],
      trim: true,
      maxlength: 1000,
    },
    resourceType: {
      type: String,
      required: [true, 'resourceType is required'],
      enum: {
        values: RESOURCE_TYPES,
        message: `resourceType must be one of: ${RESOURCE_TYPES.join(', ')}`,
      },
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: [true, 'resourceId is required'],
    },
    read: {
      type: Boolean,
      required: true,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    collection: 'notifications',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

notificationSchema.index(
  { tenantId: 1, userId: 1, createdAt: -1 },
  { name: 'idx_notifications_tenantId_userId_createdAt' },
);
notificationSchema.index(
  { tenantId: 1, userId: 1, read: 1 },
  { name: 'idx_notifications_tenantId_userId_read' },
);

const Notification =
  mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);

export default Notification;
