const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserSettings = require('../models/UserSettings');

const COMMON_PASSWORDS = new Set([
  'password','password123','123456','12345678','123456789',
  'qwerty','abc123','letmein','welcome','monkey','dragon',
  'master','iloveyou','sunshine','princess','football',
  'shadow','superman','michael','charlie',
]);

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin || false },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(req, res) {
  try {
    const { full_name, email, department, level, password } = req.body;

    if (!full_name || !email || !department || !level || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      return res.status(400).json({ message: 'This password is too common. Please choose a unique password.' });
    }

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const taken = await User.findByUsername(baseUsername);
    const username = taken
      ? `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`
      : baseUsername;

    const user = await User.createUser({
      fullName: full_name,
      email,
      department,
      level,
      passwordHash,
      username,
    });

    await UserSettings.getOrCreate(user.id);

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: User.toPrivateUser(user),
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const settings = await UserSettings.getOrCreate(user.id);
    if (settings.is_deactivated) {
      return res.status(403).json({ message: 'This account has been deactivated. Contact support to reactivate.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: User.toPrivateUser(user),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
}

module.exports = { register, login };
