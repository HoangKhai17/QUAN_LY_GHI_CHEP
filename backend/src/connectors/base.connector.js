/**
 * BaseConnector — interface mà mọi platform connector phải implement.
 * Mỗi connector chỉ lo 3 việc:
 *   1. verify()       — xác thực request đến từ đúng platform
 *   2. parse()        — chuyển payload thô → NormalizedMessage
 *   3. downloadImage()— tải ảnh về dạng Buffer
 *   4. reply()        — gửi tin nhắn phản hồi (optional)
 */
class BaseConnector {
  constructor(name) {
    this.name = name
  }

  /**
   * Xác thực chữ ký / token của request
   * @param {import('express').Request} req
   * @returns {boolean}
   */
  verify(req) {
    throw new Error(`${this.name}.verify() not implemented`)
  }

  /**
   * Parse payload thô của platform thành mảng NormalizedMessage
   * Một request có thể chứa nhiều messages (batch webhook)
   * @param {object} payload — req.body
   * @returns {import('./normalized-message').NormalizedMessage[]}
   */
  parse(payload) {
    throw new Error(`${this.name}.parse() not implemented`)
  }

  /**
   * Tải ảnh về dạng Buffer từ platform
   * @param {string} fileId — platform_message_id hoặc URL
   * @returns {Promise<Buffer>}
   */
  async downloadImage(fileId) {
    throw new Error(`${this.name}.downloadImage() not implemented`)
  }

  /**
   * Gửi tin nhắn phản hồi về platform (optional)
   * @param {string} chatId
   * @param {string} text
   */
  async reply(chatId, text) {
    // Default: no-op (không phải mọi connector đều cần reply)
  }
}

module.exports = BaseConnector
