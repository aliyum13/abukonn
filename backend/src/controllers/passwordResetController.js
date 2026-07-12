const bcrypt = require('bcryptjs');
const { BCRYPT_ROUNDS } = require('../config/security');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');

const resend = new Resend(process.env.RESEND_API_KEY);

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Always return success to avoid revealing whether email exists
    const user = await User.findByEmail(email.toLowerCase().trim());
    if (user) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await PasswordReset.createReset(email.toLowerCase().trim(), otp);

      await resend.emails.send({
        from: 'ABUkonn <noreply@abukonn.com>',
        to: email,
        subject: 'ABUkonn Password Reset',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px">
            <h2 style="margin:0 0 8px;font-size:22px;color:#111">Reset your password</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px">
              Use the code below to reset your ABUkonn password. It expires in <strong>15 minutes</strong>.
            </p>
            <div style="text-align:center;margin:32px 0">
              <span style="display:inline-block;letter-spacing:12px;font-size:40px;font-weight:700;color:#16a34a;background:#f0fdf4;padding:16px 28px;border-radius:12px;border:2px solid #bbf7d0">
                ${otp}
              </span>
            </div>
            <p style="margin:0;color:#888;font-size:13px">
              If you didn&apos;t request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    }

    res.json({ message: 'If that email is registered, you will receive a code shortly.' });
  } catch (err) {
    console.error('forgotPassword error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const reset = await PasswordReset.findValidReset(email.toLowerCase().trim(), otp.trim());
    if (!reset) {
      return res.status(400).json({ message: 'Invalid or expired code. Please try again.' });
    }

    // Issue a short-lived reset token signed with the OTP id for single-use guarantee
    const resetToken = jwt.sign(
      { reset_id: reset.id, email: reset.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ valid: true, reset_token: resetToken });
  } catch (err) {
    console.error('verifyOtp error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function resetPassword(req, res) {
  try {
    const { reset_token, new_password } = req.body;
    if (!reset_token || !new_password) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    let payload;
    try {
      payload = jwt.verify(reset_token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
    }

    const reset = await PasswordReset.findValidReset(payload.email, undefined);
    // Re-check the specific reset record is still unused
    const { rows } = await require('../config/db').query(
      `SELECT * FROM abukonn.password_resets WHERE id = $1 AND used = FALSE`,
      [payload.reset_id]
    );
    if (!rows[0]) {
      return res.status(400).json({ message: 'This reset link has already been used.' });
    }

    const hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await User.updatePassword(
      (await User.findByEmail(payload.email)).id,
      hash
    );
    await PasswordReset.markUsed(payload.reset_id);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('resetPassword error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { forgotPassword, verifyOtp, resetPassword };
