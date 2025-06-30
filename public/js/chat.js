document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatBox = document.getElementById('chat-box');
  const emailInput = document.getElementById('user-email');
  const sendEmailBtn = document.getElementById('send-email');

  const chatHistory = [];

  function appendMessage(sender, text) {
    const message = document.createElement('div');
    message.className = sender === 'user' ? 'user-message' : 'bot-message';
    message.innerText = text;
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    appendMessage('user', userMessage);
    chatHistory.push(`אתה: ${userMessage}`);
    chatInput.value = '';

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();
      const botReply = data.reply || 'מצטער, לא הצלחתי להבין את הבקשה.';
      appendMessage('bot', botReply);
      chatHistory.push(`בוט: ${botReply}`);
    } catch (err) {
      appendMessage('bot', '❌ שגיאה בשליחת ההודעה לשרת');
      console.error('שגיאה בצ\'אט:', err);
    }
  });

  sendEmailBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      alert('אנא הזן כתובת אימייל חוקית');
      return;
    }

    try {
      const response = await fetch('/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: email,
          transcript: chatHistory.join('\n')
        })
      });

      if (response.ok) {
        alert('✅ הסיכום נשלח למייל בהצלחה!');
      } else {
        alert('❌ שליחת הסיכום נכשלה');
      }
    } catch (err) {
      alert('⚠️ שגיאה בשליחת הסיכום');
      console.error('Email error:', err);
    }
  });
});
