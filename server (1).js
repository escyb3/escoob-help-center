const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db');
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '/')));

// טבלאות במסד הנתונים
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// ✨ התחברות והרשמה
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password || !name) return res.status(400).send("חסרים פרטים");
  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users(name, email, password, role) VALUES (?, ?, ?, ?)", [name, email, hash, 'user'], (err) => {
    if (err) return res.status(500).send("משתמש קיים או שגיאה");
    res.redirect('/login.html');
  });
});

app.post('/login', (req, res) => {
  const { email, password, remember } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) return res.status(401).send("משתמש לא נמצא");
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send("סיסמה שגויה");
    const options = remember ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {};
    res.cookie('user', JSON.stringify({ email: user.email, role: user.role }), options);
    res.redirect(user.role === 'admin' ? '/admin.html' : '/dashboard.html');
  });
});

app.post('/forgot', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("יש להזין מייל");
  res.send("קישור איפוס יישלח למייל אם קיים במערכת");
});

app.get('/admin.html', (req, res, next) => {
  try {
    const user = JSON.parse(req.cookies.user || '{}');
    if (user.role === 'admin') return next();
    res.redirect('/login.html');
  } catch {
    res.redirect('/login.html');
  }
});

// 🎯 דשבורד למשתמש
function getUserFromCookie(req) {
  try {
    return JSON.parse(req.cookies.user || '{}');
  } catch {
    return {};
  }
}

app.get('/me', (req, res) => {
  const user = getUserFromCookie(req);
  if (!user.email) return res.status(401).send("לא מחובר");
  db.get("SELECT name, email FROM users WHERE email = ?", [user.email], (err, row) => {
    if (err || !row) return res.status(404).send("משתמש לא נמצא");
    res.json(row);
  });
});

app.get('/user/messages', (req, res) => {
  const user = getUserFromCookie(req);
  if (!user.email) return res.status(401).send("לא מחובר");
  db.all("SELECT content, timestamp FROM messages WHERE user_email = ? ORDER BY timestamp DESC", [user.email], (err, rows) => {
    if (err) return res.status(500).send("שגיאה בשליפת הודעות");
    res.json(rows || []);
  });
});

app.post('/user/send-summary', async (req, res) => {
  const user = getUserFromCookie(req);
  if (!user.email) return res.status(401).send("לא מחובר");

  db.all("SELECT content FROM messages WHERE user_email = ? ORDER BY timestamp DESC", [user.email], async (err, rows) => {
    if (err || !rows.length) return res.status(500).send("אין שיחות לשליחה");

    const transcript = rows.map((r, i) => `${i + 1}. ${r.content}`).join("\n");

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Escoob Help Center" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "🧾 סיכום שיחה ממרכז העזרה של Escoob",
      text: transcript
    });

    res.send("נשלח");
  });
});

app.listen(PORT, () => {
  console.log("✅ server.js פועל עם התחברות + דשבורד + הרשאות");
  console.log(`🚀 http://localhost:${PORT}`);
});