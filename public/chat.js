const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const emailInput = document.getElementById('email');
const summaryButton = document.getElementById('send-summary');

let conversationHistory = [];

function appendMessage(sender, text, imageUrl = null) {
  const messageElem = document.createElement('div');
  messageElem.classList.add('message', sender === 'user' ? 'user' : 'bot');
  messageElem.innerHTML = `
    ${imageUrl ? `<img src="${imageUrl}" class="avatar">` : ''}
    <div class="text">${text}</div>
  `;
  chatContainer.appendChild(messageElem);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  appendMessage('user', message, 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
  conversationHistory.push({ role: 'user', content: message });
  userInput.value = '';
  sendButton.disabled = true;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory })
    });

    const data = await response.json();
    const reply = data.reply || 'שגיאה בהבאת תשובה מהשרת.';
    appendMessage('bot', reply, 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png');
    conversationHistory.push({ role: 'assistant', content: reply });
  } catch (error) {
    console.error(error);
    appendMessage('bot', '❌ שגיאה בשליחת ההודעה לשרת.');
  } finally {
    sendButton.disabled = false;
  }
}

async function sendSummaryEmail() {
  const email = emailInput.value.trim();
  if (!email) return alert('יש להזין כתובת אימייל תקינה.');

  try {
    const response = await fetch('/api/summary-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        conversation: conversationHistory
      })
    });

    const data = await response.json();
    if (response.ok) {
      alert('הסיכום נשלח בהצלחה למייל 🎉');
    } else {
      alert('שגיאה בשליחת הסיכום: ' + (data.error || ''));
    }
  } catch (err) {
    console.error(err);
    alert('שגיאה בשליחת הסיכום');
  }
}

sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});
summaryButton.addEventListener('click', sendSummaryEmail);
