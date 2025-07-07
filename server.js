require('dotenv').config(); // לקרוא משתני סביבה מהקובץ .env

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // משרת את קבצי האתר (HTML, CSS וכו')

function formatConversation(conversation) {
  return conversation.map(msg =>
    `<p><strong>${msg.user}:</strong> ${msg.text}</p>`
  ).join('');
}

async function sendSummaryEmail(userEmail, conversation) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // מייל מתוך .env
      pass: process.env.EMAIL_PASS  // סיסמת אפליקציה מתוך .env
    }
  });

  const htmlContent = `
    <h2>📄 סיכום שיחה מהאתר</h2>
    ${formatConversation(conversation)}
  `;

  const mailOptions = {
    from: '"Help Center" <' + process.env.EMAIL_USER + '>',
    to: ['escoob30@gmail.com', 'help-center@gmx.com', userEmail],
    subject: '📨 סיכום שיחה ממרכז העזרה',
    html: htmlContent
  };

  await transporter.sendMail(mailOptions);
}

app.post('/end-chat', async (req, res) => {
  const { userEmail, conversation } = req.body;

  if (!userEmail || !conversation) {
    return res.status(400).json({ error: 'Missing userEmail or conversation' });
  }

  try {
    await sendSummaryEmail(userEmail, conversation);
    res.status(200).json({ message: 'Summary email sent successfully' });
  } catch (error) {
    console.error('Error sending summary email:', error);
    res.status(500).json({ error: 'Failed to send summary email' });
  }
});

app.listen(port, () => {
  console.log(`✅ Help Center server running on port ${port}`);
});
