import rclpy
from rclpy.node import Node
from std_msgs.msg import Float64MultiArray
from serial import SerialException
import os
from roarm_sdk.roarm import roarm

class RoarmDriver(Node):
    def __init__(self):
        super().__init__('roarm_driver')
        self.declare_parameter('serial_port', '/dev/ttyUSB0')
        self.declare_parameter('baud_rate', 115200)

        port = self.get_parameter('serial_port').value
        baud = self.get_parameter('baud_rate').value
        self.roarm_type = os.environ.get('ROARM_MODEL', 'roarm_m3')
        self.roarm = roarm(roarm_type=self.roarm_type, port=port, baudrate=baud)

        # 订阅控制命令
        self.create_subscription(Float64MultiArray, 'roarm_command', self.command_callback, 10)
        # 发布反馈数据
        self.feedback_pub = self.create_publisher(Float64MultiArray, 'roarm_feedback', 10)

    def command_callback(self, msg: Float64MultiArray):
        data = list(msg.data)
        if not data:
            self.get_logger().warn("received empty command data")
            return

        cmd = int(data[0])
        args = data[1:]

        try:
            if cmd == 105:
                angles = self.roarm.joints_angle_get()  # 获取角度数组
                if angles:
                    feedback_msg = Float64MultiArray()
                    feedback_msg.data = angles
                    self.feedback_pub.publish(feedback_msg)
            elif cmd == 210:
                self.roarm.torque_set(int(args[0]))
                self.roarm.feedback_get()
            elif cmd == 121:
                self.roarm.joint_angle_ctrl(args[0], args[1])
                self.roarm.feedback_get()
            elif cmd == 122:
                self.roarm.joints_angle_ctrl(angles=args, speed=1000, acc=50)
                self.roarm.feedback_get()
            else:
                self.get_logger().warn(f"未知命令: {cmd}")

        except SerialException as e:
            self.get_logger().error(f"[serial error] {e}")
        except Exception as e:
            self.get_logger().error(f"[control error] {e}")

def main(args=None):
    rclpy.init(args=args)
    node = RoarmDriver()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
