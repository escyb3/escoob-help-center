const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '/')));

// DB
const db = new sqlite3.Database('./database.db');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT)");
});

// הרשמה
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password || !name) return res.status(400).send("חסרים פרטים");
  const hash = await bcrypt.hash(password, 10);

  db.run("INSERT INTO users(name, email, password, role) VALUES (?, ?, ?, ?)", [name, email, hash, 'user'], (err) => {
    if (err) return res.status(500).send("משתמש קיים או שגיאה");
    res.redirect('/login.html');
  });
});

// התחברות
app.post('/login', (req, res) => {
  const { email, password, remember } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) return res.status(401).send("משתמש לא נמצא");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send("סיסמה שגויה");

    const options = remember ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {};
    res.cookie('user', JSON.stringify({ email: user.email, role: user.role }), options);
    res.redirect(user.role === 'admin' ? '/admin.html' : '/index.html');
  });
});

// הגנת עמודים (דוגמה)
app.get('/admin.html', (req, res, next) => {
  try {
    const user = JSON.parse(req.cookies.user || '{}');
    if (user.role === 'admin') return next();
    res.redirect('/login.html');
  } catch {
    res.redirect('/login.html');
  }
});

// שכחת סיסמה (שלב בסיסי בלבד)
app.post('/forgot', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("יש להזין מייל");
  // שלח מייל איפוס סיסמה (בשלב מתקדם)
  res.send("קישור איפוס יישלח למייל אם קיים במערכת");
});

app.listen(PORT, () => {
  console.log("🔐 server_auth.js פועל עם הרשאות וסשן");
  console.log(`🚀 http://localhost:${PORT}`);
});