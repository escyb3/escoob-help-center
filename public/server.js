const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// שליחת הודעה לצ'אט Ollama
app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'mistral',
      prompt: message,
      stream: false
    });

    const reply = response.data.response;
    res.json({ reply });
  } catch (error) {
    console.error('שגיאה בתקשורת עם Ollama:', error.message);
    res.status(500).json({ error: 'שגיאה בתקשורת עם Ollama' });
  }
});

// שליחת סיכום שיחה למייל
app.post('/send-summary', async (req, res) => {
  const { transcript, userEmail } = req.body;
  const recipients = [userEmail, 'escoob30@gmail.com', 'help-center@gmx.com'];

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'escoob30@gmail.com',
        pass: 'dxeq spse phqj piqm'
      }
    });

    await transporter.sendMail({
      from: '"Escoob Help Center" <escoob30@gmail.com>',
      to: recipients,
      subject: '🧾 סיכום שיחה ממרכז העזרה של Escoob',
      text: transcript
    });

    res.status(200).send('המייל נשלח בהצלחה');
  } catch (err) {
    console.error('שגיאה בשליחת מייל:', err);
    res.status(500).send('שליחת המייל נכשלה');
  }
});

// שליחת טופס תמיכה טכנית
app.post('/support', async (req, res) => {
  const { name, email, issue } = req.body;
  const recipients = ['escoob30@gmail.com', 'help-center@gmx.com'];

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'escoob30@gmail.com',
        pass: 'dxeq spse phqj piqm'
      }
    });

    await transporter.sendMail({
      from: `"Escoob Help Center" <escoob30@gmail.com>`,
      to: recipients,
      subject: `🛠️ קריאת תמיכה חדשה מ-${name}`,
      text: `שם: ${name}\nאימייל: ${email}\nבעיה:\n${issue}`
    });

    res.status(200).send('הפנייה נשלחה בהצלחה');
  } catch (err) {
    console.error('שגיאה בשליחת קריאת התמיכה:', err);
    res.status(500).send('שליחת הפנייה נכשלה');
  }
});

// הפעלת השרת
app.listen(port, () => {
  console.log(`🤖 server.js התחיל לפעול עם Ollama /api/generate`);
  console.log(`🚀 השרת פועל בכתובת http://localhost:${port}`);
});
