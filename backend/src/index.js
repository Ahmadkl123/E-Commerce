require('dotenv').config();
const app = require('./app');

// Port definition with fallback
const PORT = process.env.PORT || 5000;

// Starts HTTP server listener.
// Kept separate from app.js so integration tests can import the app without opening network ports.
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});
