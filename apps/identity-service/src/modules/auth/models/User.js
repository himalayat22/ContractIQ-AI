import mongoose from 'mongoose';

const { Schema } = mongoose;

const USER_STATUS = ['active', 'suspended', 'deleted'];

const emailValidator = {
  validator(value) {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 255;
  },
  message: 'Invalid email format or exceeds 255 characters',
};

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 255,
      validate: emailValidator,
    },
    emailNormalized: {
      type: String,
      required: [true, 'emailNormalized is required'],
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    passwordHash: {
      type: String,
      default: null,
      validate: {
        validator(value) {
          if (value == null || value === '') return true;
          return value.startsWith('$2') && value.length >= 60;
        },
        message: 'passwordHash must be a valid bcrypt hash',
      },
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 100,
      minlength: 1,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 100,
      minlength: 1,
    },
    isSuperAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: USER_STATUS,
        message: 'status must be active, suspended, or deleted',
      },
      default: 'active',
    },
    failedLoginAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 10,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'users',
    timestamps: true,
  },
);

userSchema.pre('validate', function normalizeEmail(next) {
  if (this.email) {
    const normalized = this.email.toLowerCase().trim();
    this.email = normalized;
    this.emailNormalized = normalized;
  }
  next();
});

userSchema.index({ emailNormalized: 1 }, { unique: true, name: 'idx_users_emailNormalized_unique' });
userSchema.index({ status: 1, createdAt: -1 }, { name: 'idx_users_status' });
userSchema.index({ isSuperAdmin: 1 }, { sparse: true, name: 'idx_users_isSuperAdmin' });

userSchema.methods.isActive = function isActive() {
  return this.status === 'active' && this.deletedAt == null;
};

userSchema.methods.isLocked = function isLocked() {
  return this.lockedUntil != null && this.lockedUntil > new Date();
};

const User = mongoose.models.User ?? mongoose.model('User', userSchema);

export default User;
