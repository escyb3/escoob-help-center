document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('data/articles.json');
  const data = await res.json();

  const searchInput = document.getElementById('search');
  const categoryFilter = document.getElementById('category-filter');
  const faqList = document.getElementById('faq-list');
  const articleList = document.getElementById('article-list');

  const categories = [...new Set(data.map(item => item.category))];
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  function render() {
    const keyword = searchInput.value.toLowerCase();
    const selectedCat = categoryFilter.value;

    const filtered = data.filter(item =>
      (selectedCat === 'all' || item.category === selectedCat) &&
      (item.title.toLowerCase().includes(keyword) || item.content.toLowerCase().includes(keyword))
    );

    // שאלות נפוצות
    faqList.innerHTML = '';
    filtered.filter(item => item.type === 'faq').forEach(faq => {
      const div = document.createElement('div');
      div.className = 'faq';
      div.innerHTML = `<strong>${faq.title}</strong><p>${faq.content}</p><div class="updated">עודכן: ${faq.updated}</div>`;
      faqList.appendChild(div);
    });

    // מאמרים
    articleList.innerHTML = '';
    filtered.filter(item => item.type === 'article').forEach(article => {
      const div = document.createElement('div');
      div.className = 'article';
      div.innerHTML = `<strong>${article.title}</strong><p>${article.content}</p><div class="updated">עודכן: ${article.updated}</div>`;
      articleList.appendChild(div);
    });
  }

  searchInput.addEventListener('input', render);
  categoryFilter.addEventListener('change', render);

  render(); // הצגה ראשונית
});
