const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const axios = require('axios');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let users = [];

const loadUsers = () => {
  if (fs.existsSync('users.json')) {
    users = JSON.parse(fs.readFileSync('users.json', 'utf-8'));
  }
};

const saveUsers = () => {
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
};

loadUsers();

// AUTH
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (users.find(u => u.email === email)) return res.status(400).send("משתמש כבר קיים");
  const hash = await bcrypt.hash(password, 10);
  users.push({ name, email, password: hash, role: 'user' });
  saveUsers();
  res.send("נרשמת בהצלחה");
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).send("אימייל או סיסמה שגויים");
  res.cookie('user', email, { httpOnly: true });
  res.send("התחברת בהצלחה");
});

app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(401).send("סיסמה נוכחית שגויה");
  user.password = await bcrypt.hash(newPassword, 10);
  saveUsers();
  res.send("הסיסמה עודכנה בהצלחה");
});

app.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).send("משתמש לא נמצא");
  user.password = await bcrypt.hash(newPassword, 10);
  saveUsers();
  res.send("הסיסמה אופסה בהצלחה");
});

// Chat with Ollama
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "mistral",
      prompt: message,
      stream: false
    });
    res.json({ reply: response.data.response.trim() });
  } catch (err) {
    console.error("שגיאה בתקשורת עם Ollama:", err.message);
    res.status(500).send("שגיאה בתקשורת עם Ollama");
  }
});

// שליחת מייל עם סיכום שיחה
app.post('/send-email', async (req, res) => {
  const { transcript, userEmail } = req.body;
  const recipients = [userEmail, ...(process.env.DEFAULT_RECIPIENTS || '').split(',')].filter(Boolean);
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
    res.send('המייל נשלח בהצלחה');
  } catch (err) {
    console.error(err);
    res.status(500).send('שליחת המייל נכשלה');
  }
});

// דף ברירת מחדל
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(port, () => {
  console.log(`🤖 server.js התחיל לפעול עם Ollama /api/generate`);
  console.log(`🚀 השרת פועל בכתובת http://localhost:${port}`);
});