const Support = require('../models/Support');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'aliyumauwal13@gmail.com';

const CATEGORIES = ['Bug Report', 'Feature Request', 'Account Issue', 'Content Report', 'Other'];

async function submitTicket(req, res) {
  try {
    const { category, subject, message, email } = req.body;
    const userId = req.user?.id || null;
    const fullName = req.user?.full_name || req.body.full_name || null;
    const userEmail = email || req.user?.email;

    if (!category || !subject || !message || !userEmail) {
      return res.status(400).json({ message: 'category, subject, message and email are required' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const ticket = await Support.createTicket({ userId, email: userEmail, fullName, category, subject, message });

    // Send email notification to admin
    resend.emails.send({
      from: 'ABUkonn Support <noreply@abukonn.com>',
      to: ADMIN_EMAIL,
      subject: `[Support #${ticket.id}] ${category}: ${subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#16a34a;padding:24px;border-radius:12px 12px 0 0;">
            <h1 style="color:white;margin:0;font-size:20px;">New Support Ticket #${ticket.id}</h1>
          </div>
          <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:120px;">From</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${fullName || 'Unknown'} (${userEmail})</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Category</td><td style="padding:8px 0;font-size:14px;"><span style="background:#dcfce7;color:#16a34a;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:600;">${category}</span></td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Subject</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${subject}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;vertical-align:top;">Message</td><td style="padding:8px 0;font-size:14px;line-height:1.6;">${message.replace(/\n/g, '<br>')}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Submitted</td><td style="padding:8px 0;font-size:14px;">${new Date().toLocaleString('en-GB')}</td></tr>
            </table>
            <div style="margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;">
              <a href="https://abukonn.com/admin/support" style="background:#16a34a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View in Admin Panel</a>
            </div>
          </div>
        </div>
      `,
    }).catch(err => console.error('[Support] email error:', err.message));

    res.json({ message: 'Support ticket submitted successfully', ticket_id: ticket.id });
  } catch (err) {
    console.error('submitTicket:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getTickets(req, res) {
  try {
    const tickets = await Support.getAllTickets();
    res.json({ tickets });
  } catch (err) {
    console.error('getTickets:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateTicket(req, res) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const ticket = await Support.updateTicketStatus(id, status, admin_notes);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json({ ticket });
  } catch (err) {
    console.error('updateTicket:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { submitTicket, getTickets, updateTicket };
