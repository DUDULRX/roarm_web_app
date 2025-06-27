const WebSocket = require('ws');
const rclnodejs = require('rclnodejs');

async function initROS(node) {
  // 发布者
  const publisher = node.createPublisher('std_msgs/msg/Float64MultiArray', 'roarm_command');
  return publisher;
}

async function startServer() {
  await rclnodejs.init();
  const node = new rclnodejs.Node('websocket_ros_node');

  const publisher = await initROS(node);

  const wss = new WebSocket.Server({ port: 9090 });

  // 订阅反馈消息，收到后广播给所有 WebSocket 客户端
  node.createSubscription(
    'std_msgs/msg/Float64MultiArray',
    'roarm_feedback',
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
    console.log('[WS] 前端已连接');

    ws.on('message', (message) => {
      console.log('[WS] 收到消息:', message.toString());

      try {
        const data = JSON.parse(message.toString());
        if (Array.isArray(data)) {
          publisher.publish({ data });
          console.log('[ROS] 发布:', data);
        } else {
          console.warn('[WS] 接收到的数据不是数组:', data);
        }
      } catch (err) {
        console.error('[WS] JSON 解析失败:', err);
      }
    });

    ws.send('✅ WebSocket 已连接，发送数组将发布到 /roarm_command');
  });

  console.log('[WS] WebSocket server 启动在 ws://localhost:9090');
}

startServer();
