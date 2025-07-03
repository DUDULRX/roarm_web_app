const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 9090 });

const clients = new Set();

wss.on('connection', (ws) => {
  console.log('[WS] clients connected');
  clients.add(ws);

  ws.on('message', (message) => {
    console.log('[WS] receive:', message.toString());

    try {
      const data = JSON.parse(message.toString());

      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error('[WS] JSON decode error:', err);
    }
  });
  
  ws.on('close', () => {
    console.log('[WS] disconnected');
    clients.delete(ws);
  });
});

console.log('[WS] WebSocket Server ws://localhost:9091');

