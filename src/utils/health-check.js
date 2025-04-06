/**
 * health-check.js
 * 
 * Simple health check server for Docker container health monitoring
 */

const http = require('http');

// Create a simple HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', mode: 'simulation' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Start the server on port 3000
const PORT = process.env.HEALTH_CHECK_PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// Export the server for testing
module.exports = server;
