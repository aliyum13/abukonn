const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin || false },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(req, res) {
  try {
    const { matric_number, full_name, email, department, level, password } = req.body;

    if (!matric_number || !full_name || !email || !department || !level || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Email is the unique login identifier — check it first
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const existingMatric = await User.findByMatricNumber(matric_number);
    if (existingMatric) {
      return res.status(409).json({ message: 'Matric number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.createUser({
      matricNumber: matric_number,
      fullName: full_name,
      email,
      department,
      level,
      passwordHash,
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: User.toPublicUser(user),
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

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: User.toPublicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
}

module.exports = { register, login };
