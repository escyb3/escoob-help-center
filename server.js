// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));

const usersFile = './users.json';
const messagesFile = './messages.json';

// ====== תצורת מייל ======
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'escoob30@gmail.com',
    pass: process.env.EMAIL_PASS,
  },
});

// ====== פונקציית שליחת סיכום ======
async function sendSummaryEmail(userEmail, conversation) {
  const htmlContent = `
    <h2>📄 סיכום שיחה מהאתר</h2>
    ${conversation.map(m => `<p><strong>${m.role}:</strong> ${m.content}</p>`).join('')}
  `;
  const mailOptions = {
    from: '"Help Center" <escoob30@gmail.com>',
    to: ['escoob30@gmail.com', 'help-center@gmx.com', userEmail],
    subject: '📨 סיכום שיחה ממרכז העזרה',
    html: htmlContent,
  };
  await transporter.sendMail(mailOptions);
}

// ====== עזר: שמירת שיחות ======
function saveMessage(email, content) {
  let allMessages = [];
  if (fs.existsSync(messagesFile)) {
    allMessages = JSON.parse(fs.readFileSync(messagesFile));
  }
  allMessages.push({ email, content, timestamp: Date.now() });
  fs.writeFileSync(messagesFile, JSON.stringify(allMessages, null, 2));
}

// ====== רישום משתמש ======
app.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).send("שדות חסרים");
  let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];

  if (users.find(u => u.email === email)) return res.status(400).send("המשתמש קיים");

  const hashed = await bcrypt.hash(password, 10);
  users.push({ name, email, password: hashed, role: role || 'user' });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.sendStatus(200);
});

// ====== התחברות ======
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).send("שגוי");

  res.cookie('user', JSON.stringify({ name: user.name, email: user.email, role: user.role }), {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
  });
  res.redirect(user.role === 'admin' ? '/admin-panel.html' : '/dashboard.html');
});

// ====== שליחה לצ'אט ושמירה ======
app.post('/save-message', (req, res) => {
  const { email, content } = req.body;
  if (!email || !content) return res.status(400).send("שדות חסרים");
  saveMessage(email, content);
  res.sendStatus(200);
});

// ====== שליחת סיכום ======
app.post('/user/send-summary', (req, res) => {
  const userCookie = req.cookies.user;
  if (!userCookie) return res.status(401).send("לא מחובר");
  const user = JSON.parse(userCookie);

  const allMessages = fs.existsSync(messagesFile) ? JSON.parse(fs.readFileSync(messagesFile)) : [];
  const userMsgs = allMessages.filter(m => m.email === user.email);
  sendSummaryEmail(user.email, userMsgs.map(m => ({ role: 'משתמש', content: m.content })))
    .then(() => res.sendStatus(200))
    .catch(() => res.status(500).send("שגיאה בשליחה"));
});

// ====== קבלת מידע אישי ======
app.get('/me', (req, res) => {
  const userCookie = req.cookies.user;
  if (!userCookie) return res.status(401).send("לא מחובר");
  const user = JSON.parse(userCookie);
  res.json(user);
});

// ====== קבלת שיחות ======
app.get('/user/messages', (req, res) => {
  const userCookie = req.cookies.user;
  if (!userCookie) return res.status(401).send("לא מחובר");
  const user = JSON.parse(userCookie);
  const messages = fs.existsSync(messagesFile) ? JSON.parse(fs.readFileSync(messagesFile)) : [];
  res.json(messages.filter(m => m.email === user.email));
});

// ====== יציאה ======
app.get('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/login.html');
});

// ====== הפעלת השרת ======
app.listen(port, () => {
  console.log(`✅ Help Center server running on port ${port}`);
});
