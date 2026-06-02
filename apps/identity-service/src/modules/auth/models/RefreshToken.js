import mongoose from 'mongoose';

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^[a-f0-9]{64}$/i.test(v),
        message: 'tokenHash must be a 64-character SHA-256 hex string',
      },
    },
    familyId: {
      type: String,
      required: true,
      validate: {
        validator: (v) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
        message: 'familyId must be a UUID v4',
      },
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByTokenId: {
      type: Schema.Types.ObjectId,
      ref: 'RefreshToken',
      default: null,
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
    collection: 'refresh_tokens',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true, name: 'idx_refresh_tokens_tokenHash_unique' });
refreshTokenSchema.index({ userId: 1, createdAt: -1 }, { name: 'idx_refresh_tokens_userId' });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'idx_refresh_tokens_expiresAt_ttl' });
refreshTokenSchema.index({ familyId: 1 }, { name: 'idx_refresh_tokens_familyId' });

refreshTokenSchema.methods.isRevoked = function isRevoked() {
  return this.revokedAt != null;
};

refreshTokenSchema.methods.isExpired = function isExpired() {
  return this.expiresAt <= new Date();
};

const RefreshToken =
  mongoose.models.RefreshToken ?? mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
