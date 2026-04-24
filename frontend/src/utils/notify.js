import { notification } from 'antd'

const notify = {
  success: (msg, desc) =>
    notification.success({ message: msg, description: desc, placement: 'topRight', duration: 3 }),
  error: (msg, desc) =>
    notification.error({ message: msg, description: desc, placement: 'topRight', duration: 4 }),
  warning: (msg, desc) =>
    notification.warning({ message: msg, description: desc, placement: 'topRight', duration: 3 }),
  info: (msg, desc) =>
    notification.info({ message: msg, description: desc, placement: 'topRight', duration: 3 }),
}

export default notify
