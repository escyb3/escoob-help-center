async function fetchAdminData() {
  try {
    const [usersRes, messagesRes] = await Promise.all([
      fetch("/admin/users"),
      fetch("/admin/messages")
    ]);
    const users = await usersRes.json();
    const messages = await messagesRes.json();

    const usersTable = document.querySelector("#usersTable tbody");
    const messagesTable = document.querySelector("#messagesTable tbody");

    users.forEach(user => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${user.name}</td><td>${user.email}</td><td>${user.role}</td>`;
      usersTable.appendChild(tr);
    });

    messages.forEach(msg => {
      const tr = document.createElement("tr");
      tr.dataset.search = `${msg.email} ${msg.content}`;
      tr.innerHTML = `<td>${msg.email}</td><td>${msg.content}</td><td>${new Date(msg.timestamp).toLocaleString('he-IL')}</td>`;
      messagesTable.appendChild(tr);
    });

    document.getElementById("searchBox").addEventListener("input", function () {
      const val = this.value.toLowerCase();
      document.querySelectorAll("#messagesTable tbody tr").forEach(tr => {
        tr.style.display = tr.dataset.search.toLowerCase().includes(val) ? "" : "none";
      });
    });

  } catch (err) {
    alert("שגיאה בטעינת הנתונים");
    console.error(err);
  }
}

async function sendSummaryToAdmins() {
  const res = await fetch("/admin/send-summary", { method: "POST" });
  alert(res.ok ? "סיכום נשלח!" : "שליחה נכשלה");
}

fetchAdminData();
