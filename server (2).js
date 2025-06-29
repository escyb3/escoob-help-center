const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const path = require('path');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const db = new sqlite3.Database('./database.db');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// התחברות והרשמה
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashed], err => {
    if (err) return res.status(500).send("Email כבר קיים");
    res.status(200).send("נרשמת בהצלחה");
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) return res.status(401).send("שגיאה בהתחברות");
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(403).send("סיסמה שגויה");
    res.cookie('user', JSON.stringify({ email: user.email, name: user.name, role: user.role }), { httpOnly: true });
    res.status(200).send("התחברת בהצלחה");
  });
});

// שינוי סיסמה (דורש סיסמה נוכחית)
app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) return res.status(404).send("משתמש לא נמצא");
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(403).send("סיסמה נוכחית שגויה");
    const newHash = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE email = ?", [newHash, email], (err) => {
      if (err) return res.status(500).send("שגיאה בשמירה");
      res.send("הסיסמה עודכנה בהצלחה");
    });
  });
});

// איפוס סיסמה (לצורך הדגמה בלבד)
app.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) return res.status(404).send("משתמש לא קיים");
    const hash = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE email = ?", [hash, email], (err) => {
      if (err) return res.status(500).send("שגיאה באיפוס הסיסמה");
      res.send("הסיסמה אופסה בהצלחה");
    });
  });
});

// שליחת הודעה לצ'אט
app.post('/chat', async (req, res) => {
  const { message, email } = req.body;
  try {
    const ollamaResponse = await axios.post("http://localhost:11434/api/generate", {
      model: "mistral",
      prompt: message,
      stream: false
    });
    const reply = ollamaResponse.data.response;
    if (email) {
      db.run("INSERT INTO messages (user_email, content) VALUES (?, ?)", [email, message]);
      db.run("INSERT INTO messages (user_email, content) VALUES (?, ?)", [email, reply]);
    }
    res.json({ reply });
  } catch (error) {
    console.error("שגיאה בתקשורת עם Ollama:", error.message);
    res.status(500).send("שגיאה בתקשורת עם Ollama");
  }
});

// שליחת סיכום למייל
app.post('/send-email', async (req, res) => {
  const { transcript, userEmail } = req.body;
  const recipients = [userEmail, ...(process.env.DEFAULT_RECIPIENTS || "").split(',')].filter(Boolean);
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporter.sendMail({
      from: `"Escoob Help Center" <${process.env.EMAIL_USER}>`,
      to: recipients.join(','),
      subject: '🧾 סיכום שיחה ממרכז העזרה של Escoob',
      text: transcript
    });
    res.status(200).send('המייל נשלח בהצלחה');
  } catch (err) {
    console.error(err);
    res.status(500).send('שליחת המייל נכשלה');
  }
});

// Middleware לבדוק אם המשתמש Admin
function isAdmin(req, res, next) {
  try {
    const user = JSON.parse(req.cookies.user || '{}');
    if (user.role === 'admin') return next();
    res.status(403).send("גישה נדחתה");
  } catch {
    res.status(401).send("שגיאה בגישה");
  }
}

// נתיבי ניהול
app.get('/admin/users', isAdmin, (req, res) => {
  db.all("SELECT name, email, role FROM users", (err, rows) => {
    if (err) return res.status(500).send("שגיאה");
    res.json(rows);
  });
});

app.get('/admin/messages/:email', isAdmin, (req, res) => {
  const email = req.params.email;
  db.all("SELECT content FROM messages WHERE user_email = ? ORDER BY timestamp DESC", [email], (err, rows) => {
    if (err) return res.status(500).send("שגיאה");
    res.json(rows || []);
  });
});

app.get('/admin/messages-count', isAdmin, (req, res) => {
  db.get("SELECT COUNT(*) as total FROM messages", (err, row) => {
    if (err) return res.status(500).send("שגיאה");
    res.json({ total: row.total });
  });
});

app.delete('/admin/delete-user/:email', isAdmin, (req, res) => {
  const email = req.params.email;
  db.run("DELETE FROM users WHERE email = ?", [email], (err) => {
    if (err) return res.status(500).send("שגיאה במחיקה");
    res.send("נמחק");
  });
});

app.post('/admin/update-role', isAdmin, (req, res) => {
  const { email, role } = req.body;
  db.run("UPDATE users SET role = ? WHERE email = ?", [role, email], (err) => {
    if (err) return res.status(500).send("שגיאה בעדכון התפקיד");
    res.send("עודכן");
  });
});

app.listen(port, () => {
  console.log("🤖 server.js התחיל לפעול עם Ollama /admin /login /signup");
  console.log(`🚀 השרת פועל בכתובת http://localhost:${port}`);
});