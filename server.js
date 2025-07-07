const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// הגדרת transport לשליחת מיילים
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // למשל escoob30@gmail.com
    pass: process.env.EMAIL_PASS, // סיסמת אפליקציה
  }
});

// נתיב לקבלת טופס יצירת קשר
app.post('/submit-contact', async (req, res) => {
  const { category, name, email, message } = req.body;

  if (!category || !name || !email || !message) {
    return res.status(400).json({ error: 'כל השדות חובה' });
  }

  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: ['escoob30@gmail.com', 'help-center@gmx.com'],
    subject: `פנייה חדשה ממרכז העזרה - תחום: ${category}`,
    html: `
      <h2>פנייה חדשה ממרכז העזרה</h2>
      <p><strong>תחום:</strong> ${category}</p>
      <p><strong>שם:</strong> ${name}</p>
      <p><strong>אימייל:</strong> ${email}</p>
      <p><strong>הודעה:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בשליחת המייל' });
  }
});

// נתיב סיכום שיחה (הוספנו לדוגמה, אפשר לשדרג)
app.post('/end-chat', async (req, res) => {
  // ... כאן תוכל להשאיר את הקוד הקיים לשליחת סיכום שיחה
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`✅ Help Center server running on port ${port}`);
});
