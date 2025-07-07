
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));

let users = [];
let messages = [];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });

  res.cookie("user", JSON.stringify({ email: user.email, name: user.name, role: user.role }), { httpOnly: true });
  res.redirect('/dashboard.html');
});

app.post('/login-otp', (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  users = users.filter(u => u.email !== email);
  users.push({ email, name: email.split('@')[0], role: 'user', otp: code });

  transporter.sendMail({
    from: '"Escoob Help Center" <escoob30@gmail.com>',
    to: email,
    subject: 'קוד חד פעמי',
    text: `קוד הכניסה שלך הוא: ${code}`
  });

  res.send(`<h2>קוד נשלח למייל. הזן אותו כאן:</h2>
    <form action="/verify-otp" method="POST">
      <input type="hidden" name="email" value="${email}" />
      <input name="code" placeholder="קוד שקיבלת" required />
      <button type="submit">אישור</button>
    </form>`);
});

app.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const user = users.find(u => u.email === email && u.otp === code);
  if (!user) return res.send('קוד שגוי');

  res.cookie("user", JSON.stringify({ email, name: user.name, role: user.role }), { httpOnly: true });
  res.redirect('/dashboard.html');
});

app.post('/chat/save', (req, res) => {
  const { email, content } = req.body;
  messages.push({ email, content, timestamp: Date.now() });
  res.sendStatus(200);
});

app.post('/user/send-summary', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.sendStatus(401);

  const conv = messages.filter(m => m.email === user.email).map(m => `• ${m.content}`).join("\n");

  transporter.sendMail({
    from: '"Escoob Help Center" <escoob30@gmail.com>',
    to: [user.email, 'escoob30@gmail.com'],
    subject: 'סיכום שיחה',
    text: `הנה סיכום השיחה שלך:\n${conv}`
  });

  res.sendStatus(200);
});

app.post('/submit-contact', async (req, res) => {
  const { name, email, message, category } = req.body;
  const htmlContent = `
    <h2>פניה חדשה ממרכז העזרה</h2>
    <p><strong>שם:</strong> ${name}</p>
    <p><strong>אימייל:</strong> ${email}</p>
    <p><strong>תחום:</strong> ${category}</p>
    <p><strong>הודעה:</strong><br/>${message}</p>
  `;
  try {
    await transporter.sendMail({
      from: '"Escoob Help Center" <escoob30@gmail.com>',
      to: ['escoob30@gmail.com', 'help-center@gmx.com'],
      subject: `📩 פניה מ-${name}`,
      html: htmlContent
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בשליחת המייל' });
  }
});

app.get('/me', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.sendStatus(401);
  res.json(user);
});

app.get('/user/messages', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.sendStatus(401);
  const userMsgs = messages.filter(m => m.email === user.email);
  res.json(userMsgs);
});

app.get('/admin/users', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);
  res.json(users);
});

app.get('/admin/messages', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);
  res.json(messages);
});

app.post('/admin/send-summary', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);

  const summary = messages.map(m => `${m.email}: ${m.content}`).join("\n");
  transporter.sendMail({
    from: '"Escoob Admin" <escoob30@gmail.com>',
    to: ['escoob30@gmail.com'],
    subject: 'סיכום כולל מהמערכת',
    text: summary
  });
  res.sendStatus(200);
});

function parseUser(req) {
  try {
    const cookie = req.cookies.user;
    return cookie ? JSON.parse(cookie) : null;
  } catch {
    return null;
  }
}

app.listen(port, () => {
  console.log(`✅ Help Center server running on port ${port}`);
});
