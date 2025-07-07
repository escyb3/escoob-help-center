
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'escoob-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Load user data
const usersFile = path.join(__dirname, 'users.json');
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
} else {
  const hashedPassword = bcrypt.hashSync('admin1234', 10);
  users = { admin: { username: 'admin', password: hashedPassword, role: 'admin' } };
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = { username, role: user.role };
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html?error=1');
  }
});

// Middleware to protect dashboard
function ensureAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Admin dashboard route
app.get('/dashboard.html', ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 השרת פועל בכתובת http://localhost:${PORT}`);
});
