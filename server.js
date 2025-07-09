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

// --- עזרה בקריאה וכתיבה לקבצים ---
function loadJsonFile(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return [];
  }
}
function saveJsonFile(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// --- משתמשים ---
function loadUsers() {
  return loadJsonFile(USERS_FILE);
}
function saveUsers(data) {
  saveJsonFile(USERS_FILE, data);
}
let users = loadUsers();

// --- הודעות ---
function loadMessages() {
  return loadJsonFile(MESSAGES_FILE);
}
function saveMessages(data) {
  saveJsonFile(MESSAGES_FILE, data);
}
let messages = loadMessages();

// --- מאמרים ו-FAQ ---
function loadArticles() {
  return loadJsonFile(ARTICLES_FILE);
}
function saveArticles(data) {
  saveJsonFile(ARTICLES_FILE, data);
}
let articles = loadArticles();

// --- תגובות ---
function loadComments() {
  return loadJsonFile(COMMENTS_FILE);
}
function saveComments(data) {
  saveJsonFile(COMMENTS_FILE, data);
}
let comments = loadComments();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// --- פונקציה לזיהוי משתמש מה-cookie ---
function parseUser(req) {
  try {
    const cookie = req.cookies.user;
    return cookie ? JSON.parse(cookie) : null;
  } catch { return null; }
}

// --- כניסה בסיסמה ---
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'User not found' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });

  res.cookie("user", JSON.stringify({ email: user.email, name: user.name, role: user.role }), { httpOnly: true, maxAge: 604800000 });
  res.redirect('/dashboard.html');
});

// --- כניסה עם OTP ---
app.post('/login-otp', (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // הסרת קודי OTP ישנים לאותו אימייל
  users = users.filter(u => !(u.email === email && u.otp));
  users.push({ email, name: email.split('@')[0], role: 'user', otp: code });
  saveUsers(users);

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

// --- אימות קוד OTP ---
app.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const user = users.find(u => u.email === email && u.otp === code);
  if (!user) return res.send('קוד שגוי');

  user.otp = null;
  saveUsers(users);

  res.cookie("user", JSON.stringify({ email, name: user.name, role: user.role }), { httpOnly: true, maxAge: 604800000 });
  res.redirect('/dashboard.html');
});

// --- שמירת שיחות ---
app.post('/chat/save', (req, res) => {
  const { email, content } = req.body;
  messages.push({ email, content, timestamp: Date.now() });
  saveMessages(messages);
  res.sendStatus(200);
});

// --- סיכום שיחה למייל ---
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

// --- שמירת פניות "צור קשר" ---
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

// --- מידע אישי ---
app.get('/me', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.sendStatus(401);
  res.json(user);
});

// --- הודעות משתמש ---
app.get('/user/messages', (req, res) => {
  const user = parseUser(req);
  if (!user) return res.sendStatus(401);
  const userMsgs = messages.filter(m => m.email === user.email);
  res.json(userMsgs);
});

// --- דשבורד ניהול ---
// משתמשים
app.get('/admin/users', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);
  res.json(users);
});
// הודעות
app.get('/admin/messages', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);
  res.json(messages);
});
// סיכום כולל למייל
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

// ====================
// ניהול מאמרים ו-FAQ
// ====================

// קבלת כל המאמרים
app.get('/articles', (req, res) => {
  res.json(articles);
});

// הוספה / עדכון מאמר (או FAQ)
app.post('/admin/articles', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);

  const article = req.body;
  if (!article.id) {
    // חדש
    article.id = articles.length ? Math.max(...articles.map(a => a.id)) + 1 : 1;
    articles.push(article);
  } else {
    // עדכון
    const index = articles.findIndex(a => a.id === article.id);
    if (index >= 0) {
      articles[index] = article;
    } else {
      articles.push(article);
    }
  }
  saveArticles(articles);
  res.json({ success: true, article });
});

// מחיקת מאמר
app.delete('/admin/articles/:id', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);

  const id = parseInt(req.params.id);
  articles = articles.filter(a => a.id !== id);
  saveArticles(articles);
  res.json({ success: true });
});

// ====================
// ניהול תגובות למאמרים
// ====================

// קבלת תגובות למאמר ספציפי
app.get('/comments/:articleId', (req, res) => {
  const articleId = parseInt(req.params.articleId);
  const articleComments = comments.filter(c => c.articleId === articleId);
  res.json(articleComments);
});

// הוספת תגובה למאמר
app.post('/comments', (req, res) => {
  const { articleId, author, content } = req.body;
  if (!articleId || !author || !content) return res.status(400).json({ error: "Missing fields" });

  const comment = {
    id: comments.length ? Math.max(...comments.map(c => c.id)) + 1 : 1,
    articleId,
    author,
    content,
    date: new Date().toISOString()
  };
  comments.push(comment);
  saveComments(comments);
  res.json({ success: true, comment });
});

// מחיקת תגובה (למנהלים בלבד)
app.delete('/admin/comments/:id', (req, res) => {
  const user = parseUser(req);
  if (!user || user.role !== 'admin') return res.sendStatus(403);

  const id = parseInt(req.params.id);
  comments = comments.filter(c => c.id !== id);
  saveComments(comments);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
