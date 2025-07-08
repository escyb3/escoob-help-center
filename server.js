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
app.use(cookieParser());
app.use(express.static('public'));

const USERS_FILE = './data/users.json';
const MESSAGES_FILE = './data/messages.json';
const ARTICLES_FILE = './data/articles.json';
const COMMENTS_FILE = './data/comments.json';

function loadJson(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let users = loadJson(USERS_FILE);
let messages = loadJson(MESSAGES_FILE);
let articles = loadJson(ARTICLES_FILE);
let comments = loadJson(COMMENTS_FILE);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// פונקציית עזר לניתוח משתמש
function parseUser(req) {
  try {
    const cookie = req.cookies.user;
    return cookie ? JSON.parse(cookie) : null;
  } catch {
    return null;
  }
}

// --- מערכת התחברות ---

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });

  res.cookie("user", JSON.stringify({ email: user.email, name: user.name, role: user.role }), { httpOnly: true, maxAge: 604800000 });
  res.redirect('/dashboard.html');
});

app.post('/login-otp', (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  users = users.filter(u => u.email !== email || u.passwordHash);
  users.push({ email, name: email.split('@')[0], role: 'user', otp: code });
  saveJson(USERS_FILE, users);

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

  user.otp = null;
  saveJson(USERS_FILE, users);

  res.cookie("user", JSON.stringify({ email, name: user.name, role: user.role }), { httpOnly: true, maxAge: 604800000 });
  res.redirect('/dashboard.html');
});

// --- שמירת שיחות ---

app.post('/chat/save', (req, res) => {
  const { email, content } = req.body;
  messages.push({ email, content, timestamp: Date.now() });
  saveJson(MESSAGES_FILE, messages);
  res.sendStatus(200);
});

// --- שליחת סיכום שיחה למייל ---

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

// --- צור קשר ---

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
  } catch {
    res.status(500).json({ error: 'שגיאה בשליחת המייל' });
  }
});

// --- מידע אישי והודעות ---

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

// --- ניהול עבור אדמין ---

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

app.get('/admin/messages/by-date', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);

  const grouped = {};
  messages.forEach(m => {
    const date = new Date(m.timestamp).toISOString().split('T')[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(m);
  });

  res.json(grouped);
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

// --- מאמרים ו-FAQ ---

app.get('/articles/:lang?', (req, res) => {
  const lang = req.params.lang || 'he';
  const filtered = articles.filter(a => a.lang === lang || !a.lang);
  res.json(filtered);
});

app.get('/articles/search/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const results = articles.filter(a =>
    a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query)
  );
  res.json(results);
});

app.post('/admin/import-articles', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);

  const imported = req.body.articles;
  if (!Array.isArray(imported)) return res.status(400).json({ error: 'Invalid format' });

  articles = imported;
  saveJson(ARTICLES_FILE, articles);
  res.json({ success: true });
});

// --- תגובות למאמרים ---

app.get('/comments/:articleId', (req, res) => {
  const id = Number(req.params.articleId);
  const articleComments = comments.filter(c => c.articleId === id);
  res.json(articleComments);
});

app.post('/comments/:articleId', (req, res) => {
  const articleId = Number(req.params.articleId);
  const { name, text } = req.body;

  const comment = { id: Date.now(), articleId, name, text, timestamp: Date.now() };
  comments.push(comment);
  saveJson(COMMENTS_FILE, comments);
  res.json({ success: true });
});

// --- התחלת השרת ---

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

