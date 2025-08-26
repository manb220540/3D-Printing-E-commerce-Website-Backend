const jwt = require('jsonwebtoken');
const db = require('../config/db');
const asyncHandler = require('express-async-handler');

module.exports = asyncHandler(async (req, res, next) => {
  let token;

  // Debugging logs - Đặt ở đầu để luôn chạy
  console.log('--- Auth Middleware Start ---');
  console.log('Request URL:', req.originalUrl); // URL của request
  console.log('Authorization Header from Client:', req.headers.authorization);

  // 1. Kiểm tra header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Tách chuỗi Bearer <token> để lấy token
      token = req.headers.authorization.split(' ')[1];
      console.log('Extracted Token:', token); // Debug

      // Nếu token không tồn tại sau khi tách
      if (!token) {
        console.log('Error: Token is empty after split'); // Debug
        return res.status(401).json({ message: 'Không có token, quyền truy cập bị từ chối' });
      }

      // 3. Xác minh token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded Token Payload:', decoded); // Debug - Rất quan trọng!

      // Gán user cơ bản từ token
      req.user = { id: decoded.id, username: decoded.username };

      // Truy vấn CSDL để lấy vai trò và các thông tin khác
      const [userRows] = await db.execute('SELECT role FROM users WHERE id = ?', [decoded.id]);
      if (userRows.length === 0) {
        console.log(`Error: User with ID ${decoded.id} not found in DB.`); // Debug
        return res.status(401).json({ message: 'Người dùng không tồn tại' });
      }
      req.user.role = userRows[0].role; // Gắn vai trò từ CSDL
      console.log('Authenticated User:', req.user); // Debug
      console.log('User Role:', req.user.role); // Debug

      next(); // Chuyển sang middleware hoặc route handler tiếp theo

    } catch (error) { // Biến 'error' được định nghĩa tại đây
      console.error('Lỗi xác thực token trong auth middleware:', error.name, error.message); // Debug
      // Xử lý các loại lỗi JWT cụ thể
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token đã hết hạn' });
      }
      if (error.name === 'JsonWebTokenError') {
        // Bao gồm 'invalid signature', 'jwt malformed', v.v.
        return res.status(401).json({ message: 'Token không hợp lệ' });
      }
      // Xử lý các lỗi khác không phải từ JWT (ví dụ: lỗi DB bất ngờ, v.v.)
      return res.status(401).json({ message: 'Lỗi xác thực, không được ủy quyền' });
    }
  } else {
    // Nếu không có header Authorization hoặc không bắt đầu bằng Bearer
    console.log('Error: No Authorization header or not starting with Bearer.'); // Debug
    return res.status(401).json({ message: 'Không có token Authorization, quyền truy cập bị từ chối' });
  }
  console.log('--- Auth Middleware End ---'); // Debug
});