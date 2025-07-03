const WebSocket = require('ws');
const rclnodejs = require('rclnodejs');

async function initROS(node) {
  // pub
  const publisher = node.createPublisher('std_msgs/msg/Float64MultiArray', 'roarm_leader_command');
  return publisher;
}

async function startServer() {
  await rclnodejs.init();
  const node = new rclnodejs.Node('websocket_ros_node');

  const publisher = await initROS(node);

  const wss = new WebSocket.Server({ port: 9091 });

  node.createSubscription(
    'std_msgs/msg/Float64MultiArray',
    'roarm_leader_feedback',
    (msg) => {
      const feedback = {
        type: 'feedback',
        data: msg.data,
      };
      const json = JSON.stringify(feedback);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(json);
        }
      });
    }
  );

  rclnodejs.spin(node);

  wss.on('connection', (ws) => {
    console.log('[WS] connected');

    ws.on('message', (message) => {
      console.log('[WS] receive:', message.toString());

      try {
        const data = JSON.parse(message.toString());
        if (Array.isArray(data)) {
          publisher.publish({ data });
          console.log('[ROS] pub:', data);
        } else {
          console.warn('[WS] receive error:', data);
        }
      } catch (err) {
        console.error('[WS] JSON decode error :', err);
      }
    });
  });

  console.log('[WS] WebSocket server ws://localhost:9090');
}

startServer();
