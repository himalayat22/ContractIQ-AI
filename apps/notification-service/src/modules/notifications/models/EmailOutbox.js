import mongoose from 'mongoose';

const { Schema } = mongoose;

export const EMAIL_OUTBOX_STATUSES = ['pending', 'sent', 'failed'];

const emailOutboxSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    to: {
      type: String,
      required: [true, 'to is required'],
      trim: true,
      maxlength: 255,
    },
    templateId: {
      type: String,
      required: [true, 'templateId is required'],
      trim: true,
    },
    templateData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    subject: {
      type: String,
      required: [true, 'subject is required'],
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: EMAIL_OUTBOX_STATUSES,
        message: `status must be one of: ${EMAIL_OUTBOX_STATUSES.join(', ')}`,
      },
      default: 'pending',
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 5,
    },
    lastError: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    scheduledAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    collection: 'email_outbox',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

emailOutboxSchema.index(
  { status: 1, scheduledAt: 1 },
  { name: 'idx_email_outbox_status_scheduledAt' },
);

const EmailOutbox =
  mongoose.models.EmailOutbox ?? mongoose.model('EmailOutbox', emailOutboxSchema);

export default EmailOutbox;
