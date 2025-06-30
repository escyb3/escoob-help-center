const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const session = require('express-session');

dotenv.config();
const app = express();
const port = process.env.PORT || 10000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'escoob-secret',
  resave: false,
  saveUninitialized: true
}));

// ====== 🌐 צ'אט עם Ollama ======
app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const ollamaRes = await axios.post("http://localhost:11434/api/generate", {
      model: "mistral",
      prompt: message,
      stream: false
    });

    res.json({ reply: ollamaRes.data.response });
  } catch (err) {
    console.error("❌ שגיאה בתקשורת עם Ollama:", err.message);
    res.status(500).send("שגיאה בתקשורת עם Ollama");
  }
});

// ====== ✉️ שליחת סיכום שיחה למייל ======
app.post('/send-email', async (req, res) => {
  const { transcript, userEmail } = req.body;
  const recipients = [userEmail, process.env.DEFAULT_RECIPIENTS].filter(Boolean).join(',');

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
      to: recipients,
      subject: '🧾 סיכום שיחה ממרכז העזרה של Escoob',
      text: transcript
    });

    res.send('✅ המייל נשלח בהצלחה');
  } catch (err) {
    console.error('❌ שגיאה בשליחת מייל:', err.message);
    res.status(500).send('שגיאה בשליחת המייל');
  }
});

// ====== 🔐 כניסת משתמש ======
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const users = JSON.parse(fs.readFileSync('./db/users.json', 'utf8'));
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).send("משתמש לא נמצא");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).send("סיסמה שגויה");

  req.session.user = { email, role: user.role };
  res.send("התחברת בהצלחה");
});

// ====== 👥 הרשאות לפי תפקיד ======
app.get('/admin', (req, res) => {
  if (req.session.user?.role !== 'admin') {
    return res.status(403).send("אין לך הרשאה לגשת לכאן");
  }
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// ====== 📝 רישום משתמש חדש ======
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  const users = JSON.parse(fs.readFileSync('./db/users.json', 'utf8'));
  if (users.find(u => u.email === email)) {
    return res.status(400).send("המשתמש כבר קיים");
  }

  users.push({ email, password: hashed, role: 'user' });
  fs.writeFileSync('./db/users.json', JSON.stringify(users, null, 2));
  res.send("נרשמת בהצלחה");
});

// ====== 🌐 דפי HTML ======
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chat.html'));
});
app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/support.html'));
});

// ====== 🚀 הפעלת השרת ======
app.listen(port, () => {
  console.log(`🚀 השרת פועל בכתובת http://localhost:${port}`);
});
