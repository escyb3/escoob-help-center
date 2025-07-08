async function loadArticles() {
  const res = await fetch('/api/articles');
  const articles = await res.json();
  const container = document.getElementById('articles');
  container.innerHTML = '';
  articles.forEach(article => {
    const div = document.createElement('div');
    div.className = 'article';
    div.innerHTML = `
      <strong>${article.title}</strong> (${article.category}, ${article.type})
      <p>${article.content}</p>
      <button onclick="editArticle(${article.id})">✏️ ערוך</button>
      <button onclick="deleteArticle(${article.id})">🗑️ מחק</button>
    `;
    container.appendChild(div);
  });
}

async function saveArticle() {
  const id = document.getElementById('editId').value;
  const payload = {
    title: document.getElementById('title').value,
    content: document.getElementById('content').value,
    category: document.getElementById('category').value,
    type: document.getElementById('type').value,
    updated: new Date().toISOString().slice(0, 10)
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/articles/${id}` : '/api/articles';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    clearForm();
    loadArticles();
  } else {
    alert('שגיאה בשמירה');
  }
}

function editArticle(id) {
  fetch('/api/articles')
    .then(res => res.json())
    .then(articles => {
      const a = articles.find(x => x.id === id);
      if (a) {
        document.getElementById('editId').value = a.id;
        document.getElementById('title').value = a.title;
        document.getElementById('content').value = a.content;
        document.getElementById('category').value = a.category;
        document.getElementById('type').value = a.type;
      }
    });
}

async function deleteArticle(id) {
  if (confirm("האם אתה בטוח שברצונך למחוק?")) {
    const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
    if (res.ok) loadArticles();
  }
}

function clearForm() {
  document.getElementById('editId').value = '';
  document.getElementById('title').value = '';
  document.getElementById('content').value = '';
  document.getElementById('category').value = '';
  document.getElementById('type').value = 'article';
}

function logout() {
  document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
  location.href = '/login.html';
}

loadArticles();
