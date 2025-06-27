const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let chatLogs = {};

console.log("🤖 server.js המשודרג התחיל לפעול עם Ollama");

app.post('/chat', async (req, res) => {
  const { message, userEmail } = req.body;

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "gemma:2b",
      prompt: message,
      stream: false
    });

    const reply = response.data.response;

    const logEntry = `🧍 משתמש: ${message}\n🤖 בוט: ${reply}\n\n`;
    fs.appendFileSync('chat_log.txt', logEntry, 'utf8');

    if (userEmail) {
      chatLogs[userEmail] = (chatLogs[userEmail] || "") + logEntry;
    }

    res.json({ reply });

  } catch (err) {
    console.error("❌ שגיאה מול Ollama:", err.message);
    res.status(500).send('שגיאה בתקשורת עם הבוט המקומי');
  }
});

app.post('/send-email', async (req, res) => {
  const { userEmail } = req.body;
  const fullTranscript = chatLogs[userEmail] || "לא נמצאה שיחה עבור כתובת זו.";

  const recipients = [userEmail, "escoob30@gmail.com", "help-center@gmx.com"];

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: "escoob30@gmail.com",
      pass: "mykey.michalbojji3"
    }
  });

  try {
    await transporter.sendMail({
      from: '"Escoob Help Center" <escoob30@gmail.com>',
      to: recipients.join(','),
      subject: "🧾 סיכום שיחה ממרכז העזרה של Escoob",
      text: fullTranscript
    });

    res.status(200).send("המייל נשלח בהצלחה!");
  } catch (err) {
    console.error("❌ שגיאת מייל:", err.message);
    res.status(500).send("שליחת המייל נכשלה");
  }
});

app.listen(port, () => {
  console.log(`🚀 השרת פועל בכתובת http://localhost:${port}`);
});