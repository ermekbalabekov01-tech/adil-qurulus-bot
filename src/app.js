const express = require('express');
const app = express();

const whatsappRoutes = require('./routes/whatsapp.routes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', whatsappRoutes);

app.get('/', (req, res) => {
  res.send('✅ Server is working');
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;