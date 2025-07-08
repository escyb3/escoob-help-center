document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("articlesContainer");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");

  let articles = [];

  async function fetchArticles() {
    const res = await fetch("data/articles.json");
    articles = await res.json();
    renderArticles(articles);
    renderCategories(articles);
  }

  function renderCategories(articles) {
    const categories = [...new Set(articles.map(a => a.category))];
    categories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      categoryFilter.appendChild(option);
    });
  }

  function renderArticles(data) {
    container.innerHTML = "";
    data.forEach(article => {
      const articleEl = document.createElement("div");
      articleEl.className = "article";

      const header = document.createElement("div");
      header.className = "article-header";
      header.textContent = article.title;
      header.addEventListener("click", () => {
        content.style.display = content.style.display === "block" ? "none" : "block";
      });

      const content = document.createElement("div");
      content.className = "article-content";
      content.innerHTML = `
        <div class="article-meta">קטגוריה: ${article.category} | עודכן לאחרונה: ${article.updated}</div>
        <div>${article.content}</div>
      `;

      articleEl.appendChild(header);
      articleEl.appendChild(content);
      container.appendChild(articleEl);
    });
  }

  function filterArticles() {
    const keyword = searchInput.value.toLowerCase();
    const selectedCat = categoryFilter.value;
    const filtered = articles.filter(a =>
      (a.title.toLowerCase().includes(keyword) || a.content.toLowerCase().includes(keyword)) &&
      (selectedCat === "" || a.category === selectedCat)
    );
    renderArticles(filtered);
  }

  searchInput.addEventListener("input", filterArticles);
  categoryFilter.addEventListener("change", filterArticles);

  fetchArticles();
});
