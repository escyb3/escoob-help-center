require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// הגדרת transport לשליחת מיילים (עדכן עם פרטי אימייל אמיתיים)
const transporter = nodemailer.createTransport({
  service: 'gmail', // או שירות אחר לפי הצורך
  auth: {
    user: process.env.EMAIL_USER, // מהקובץ .env
    pass: process.env.EMAIL_PASS,
  },
});

// נקודת קצה לטיפול בטופס צור קשר
app.post('/submit-contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: ['escoob30@gmail.com', 'help-center@gmx.com'],
      subject: 'פנייה מאתר מרכז העזרה - צור קשר',
      html: `<p>שם: ${name}</p><p>אימייל: ${email}</p><p>הודעה:</p><p>${message}</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'פנייתך נשלחה בהצלחה' });
  } catch (error) {
    console.error('Error sending contact email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// נקודת קצה לטיפול בפניות תמיכה טכנית
app.post('/submit-support', async (req, res) => {
  try {
    const { issue } = req.body;
    if (!issue) {
      return res.status(400).json({ error: 'Missing issue description' });
    }

    const mailOptions = {
      from: '"Support Form" <escoob30@gmail.com>',
      to: ['escoob30@gmail.com', 'help-center@gmx.com'],
      subject: 'פנייה לתמיכה טכנית',
      html: `<p>בעיה:</p><p>${issue}</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'הפנייה לתמיכה התקבלה, ניצור איתך קשר בהקדם' });
  } catch (error) {
    console.error('Error sending support email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// נקודת קצה לצ'אט עם Ollama
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    const response = await axios.post('https://api.ollama.com/v1/chat/completions', {
      model: 'gemma:2b',
      messages: [{ role: 'user', content: userMessage }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
      }
    });

    const botReply = response.data.choices[0].message.content;
    res.json({ reply: botReply });
  } catch (error) {
    console.error('Error in /chat:', error.message || error);
    res.status(500).json({ error: 'Server error' });
  }
});

// סטטית (אם יש לך תיקיית public עם קבצים סטטיים)
app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Help Center server running on port ${port}`);
});
