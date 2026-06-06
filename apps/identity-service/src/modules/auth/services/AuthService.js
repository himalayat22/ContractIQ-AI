import bcrypt from 'bcrypt';
import User from '../../../models/User.js';
import { AppError } from '../../../utils/AppError.js';
import { signAccessToken } from '../utils/jwt.js';

export default class AuthService {
  async register(payload) {
    const { name, email, password } = payload;

    if (!name || !email || !password) {
      throw new AppError('Missing required fields', {
        statusCode: 400,
      });
    }

    const existingUser = await User.findOne({
      emailNormalized: email.toLowerCase().trim(),
    });

    if (existingUser) {
      throw new AppError('User already exists', {
        statusCode: 409,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const parts = name.trim().split(' ');

    const firstName = parts[0];

    const lastName =
      parts.length > 1
        ? parts.slice(1).join(' ')
        : 'User';

    const user = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      emailVerified: true,
    });

    const token = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens: token,
    };
  }

  async login(payload) {
    const { email, password } = payload;

    const user = await User.findOne({
      emailNormalized: email.toLowerCase().trim(),
    });

    if (!user) {
      throw new AppError('Invalid credentials', {
        statusCode: 401,
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!valid) {
      throw new AppError('Invalid credentials', {
        statusCode: 401,
      });
    }

    const token = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens: token,
    };
  }
}