const asyncHandler = require('express-async-handler');

module.exports = asyncHandler(async (req, res, next) => {
  // Kiểm tra xem req.user đã được gán bởi middleware auth
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Không có thông tin người dùng hoặc vai trò' });
  }

  // Kiểm tra vai trò admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập vào khu vực này. Chỉ dành cho admin.' });
  }

  next(); // Cho phép tiếp tục nếu là admin
});