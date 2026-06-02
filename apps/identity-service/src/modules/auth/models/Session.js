import mongoose from 'mongoose';

const { Schema } = mongoose;

const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenId: {
      type: Schema.Types.ObjectId,
      ref: 'RefreshToken',
      required: true,
    },
    lastActiveAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    userAgent: {
      type: String,
      maxlength: 512,
      default: null,
    },
    ipAddress: {
      type: String,
      maxlength: 45,
      default: null,
    },
  },
  {
    collection: 'sessions',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

sessionSchema.index({ userId: 1, lastActiveAt: -1 }, { name: 'idx_sessions_userId' });
sessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 2592000, name: 'idx_sessions_lastActiveAt_ttl' });

const Session = mongoose.models.Session ?? mongoose.model('Session', sessionSchema);

export default Session;
