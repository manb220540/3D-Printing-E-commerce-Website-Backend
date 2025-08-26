// backend/config/email.js

// Import thư viện nodemailer để gửi email
const nodemailer = require('nodemailer');
// Import thư viện crypto để tạo mã OTP ngẫu nhiên
const crypto = require('crypto');
// Import dotenv để sử dụng biến môi trường từ file .env
require('dotenv').config();

// Cấu hình transporter cho dịch vụ email (sử dụng Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Sử dụng dịch vụ Gmail
  host: 'smtp.gmail.com', // Địa chỉ server SMTP của Gmail
  port: 587, // Cổng SMTP cho kết nối TLS
  secure: false, // Sử dụng TLS (false cho cổng 587, true cho cổng 465)
  auth: {
    user: process.env.EMAIL_USER, // Email người gửi từ biến môi trường
    pass: process.env.EMAIL_PASS, // Mật khẩu ứng dụng từ biến môi trường
  },
});

// Hàm tạo mã OTP 6 chữ số
const generateOTP = () => {
  // Tạo số ngẫu nhiên từ 100000 đến 999999 và chuyển thành chuỗi
  return crypto.randomInt(100000, 999999).toString();
};

// Hàm gửi email xác nhận chứa mã OTP
const sendVerificationEmail = async (email, otp) => {
  // Cấu hình nội dung email
  const mailOptions = {
    from: process.env.EMAIL_USER, // Địa chỉ email người gửi
    to: email, // Địa chỉ email người nhận
    subject: 'Xác nhận đổi mật khẩu - Print3D', // Chủ đề email
    html: `
      <h3>Xin chào,</h3>
      <p>Chúng tôi đã nhận được yêu cầu đổi mật khẩu cho tài khoản của bạn. Dưới đây là mã xác nhận (OTP) để hoàn tất quá trình:</p>
      <h2 style="color: #0d6efd">${otp}</h2> <!-- Hiển thị mã OTP -->
      <p>Vui lòng nhập mã này vào trang xác nhận để tiếp tục. Mã có hiệu lực trong 10 phút.</p>
      <p>Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này hoặc liên hệ với chúng tôi.</p>
      <p>Trân trọng,<br>Đội ngũ Print3D</p>
    `, // Nội dung email dạng HTML
  };

  try {
    // Gửi email với cấu hình đã định nghĩa
    await transporter.sendMail(mailOptions);
    // In thông báo khi gửi email thành công
    console.log(`Email sent to ${email} with OTP ${otp}`);
  } catch (error) {
    // Xử lý lỗi nếu gửi email thất bại
    console.error('Error sending email:', error);
    // Ném lỗi để báo hiệu gửi email thất bại
    throw new Error('Failed to send verification email');
  }
};

// Xuất các đối tượng và hàm để sử dụng ở các file khác
module.exports = { transporter, generateOTP, sendVerificationEmail };