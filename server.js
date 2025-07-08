require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

const USERS_FILE = './data/users.json';
const MESSAGES_FILE = './data/messages.json';
const ARTICLES_FILE = './data/articles.json';

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let users = loadJSON(USERS_FILE);
let messages = loadJSON(MESSAGES_FILE);
let articles = loadJSON(ARTICLES_FILE);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// עזר
function parseUser(req) {
  try {
    const cookie = req.cookies.user;
    return cookie ? JSON.parse(cookie) : null;
  } catch {
    return null;
  }
}

// התחברות בסיסמה
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });

  res.cookie("user", JSON.stringify({ email: user.email, name: user.name, role: user.role }), { httpOnly: true, maxAge: 604800000 });
  res.redirect('/dashboard.html');
});

// התחברות OTP
app.post('/login-otp', (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  users = users.filter(u => u.email !== email || u.passwordHash);
  users.push({ email, name: email.split('@')[0], role: 'user', otp: code });
  saveJSON(USERS_FILE, users);

  transporter.sendMail({
    from: '"Escoob Help Center" <escoob30@gmail.com>',
    to: email,
    subject: 'קוד חד פעמי',
    text: `קוד הכניסה שלך הוא: ${code}`
  });

  res.send(`<h2>קוד נשלח למייל:</h2>
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
  user.otp = null;
  saveJSON(USERS_FILE, users);
  res.cookie("user", JSON.stringify({ email, name: user.name, role: user.role }), { httpOnly: true, maxAge: 604800000 });
  res.redirect('/dashboard.html');
});

// איפוס סיסמה
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const resetToken = Math.random().toString(36).substring(2, 12);
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.resetToken = resetToken;
  saveJSON(USERS_FILE, users);

  const resetUrl = `${process.env.BASE_URL || 'http://localhost:' + port}/reset-password.html?token=${resetToken}&email=${email}`;
  transporter.sendMail({
    from: '"Escoob Help Center" <escoob30@gmail.com>',
    to: email,
    subject: 'איפוס סיסמה',
    html: `<p>לאיפוס הסיסמה לחץ <a href="${resetUrl}">כאן</a></p>`
  });

  res.json({ success: true });
});

app.post('/reset-password', async (req, res) => {
  const { email, token, password } = req.body;
  const user = users.find(u => u.email === email && u.resetToken === token);
  if (!user) return res.status(400).json({ error: 'Invalid token' });

  user.passwordHash = await bcrypt.hash(password, 10);
  delete user.resetToken;
  saveJSON(USERS_FILE, users);

  res.json({ success: true });
});

// מידע אישי
app.get('/me', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.sendStatus(401);
  res.json(user);
});

// שמירת שיחה
app.post('/chat/save', (req, res) => {
  const { email, content } = req.body;
  messages.push({ email, content, timestamp: Date.now() });
  saveJSON(MESSAGES_FILE, messages);
  res.sendStatus(200);
});

// סיכום שיחה למייל
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

// פניות צור קשר
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

// דשבורד ניהול
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

// --- מאמרים ---
app.get('/articles', (req, res) => {
  res.json(articles);
});

app.post('/articles', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);
  const newArticle = req.body;
  newArticle.id = articles.length ? Math.max(...articles.map(a => a.id)) + 1 : 1;
  newArticle.updated = new Date().toISOString().slice(0, 10);
  articles.push(newArticle);
  saveJSON(ARTICLES_FILE, articles);
  res.json({ success: true });
});

app.put('/articles/:id', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);
  const id = parseInt(req.params.id);
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) return res.sendStatus(404);
  articles[index] = { ...articles[index], ...req.body, updated: new Date().toISOString().slice(0, 10) };
  saveJSON(ARTICLES_FILE, articles);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
