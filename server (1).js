const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

// יצירת DB אם לא קיים
const db = new sqlite3.Database('./database.db');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, role TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
  db.run("CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// API: שליחת הודעה לצ'אט
app.post('/chat', async (req, res) => {
  const { message, userEmail } = req.body;
  if (!message) return res.status(400).send("הודעה ריקה");

  db.run("INSERT INTO messages(email, role, content) VALUES (?, 'user', ?)", [userEmail || 'אנונימי', message]);

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "mistral", prompt: message, stream: false })
    });

    const data = await response.json();
    const reply = data.response?.trim() || "מצטער, לא הבנתי. נסה שוב.";

    db.run("INSERT INTO messages(email, role, content) VALUES (?, 'bot', ?)", [userEmail || 'אנונימי', reply]);
    res.json({ reply });
  } catch (err) {
    console.error("שגיאה בתקשורת עם Ollama:", err.message);
    res.status(500).json({ reply: "❌ שגיאה בתקשורת עם הבוט. נסה מאוחר יותר." });
  }
});

// API: שליחת מייל עם סיכום
app.post('/send-email', async (req, res) => {
  const { transcript, userEmail } = req.body;
  const recipients = [userEmail, ...(process.env.DEFAULT_RECIPIENTS?.split(',') || [])];

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
      subject: "🧾 סיכום שיחה מהאתר",
      text: transcript
    });

    res.status(200).send("✅ המייל נשלח בהצלחה");
  } catch (err) {
    console.error("שגיאה בשליחת המייל:", err.message);
    res.status(500).send("❌ שליחת המייל נכשלה");
  }
});

// API: שמירת טופס צור קשר
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!email || !message) return res.status(400).send("שדות חובה חסרים");

  db.run("INSERT INTO contacts(name, email, message) VALUES (?, ?, ?)", [name, email, message], (err) => {
    if (err) return res.status(500).send("שגיאה בשמירת הפניה");
    res.send("✅ פנייתך התקבלה ונשמרה");
  });
});

// API: שליפת פניות לדשבורד
app.get('/admin/messages', (req, res) => {
  db.all("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50", (err, rows) => {
    if (err) return res.status(500).send("שגיאה בשליפת השיחות");
    res.json(rows);
  });
});

app.listen(port, () => {
  console.log("🤖 server.js התחיל לפעול עם Ollama + DB");
  console.log(`🚀 השרת פועל בכתובת http://localhost:${port}`);
});