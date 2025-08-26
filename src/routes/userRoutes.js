const express = require('express');
const {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUser,
  deleteUser,
  addAdmin,
  removeAdmin,
  updateUserRole,
  changePassword,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getUserCount
} = require('../controllers/userController');
const auth = require('../middlewares/auth');
const authAdmin = require('../middlewares/authAdmin');
const router = express.Router();

// Đăng ký người dùng mới
router.post('/register', register);

// Đăng nhập người dùng
router.post('/login', login);

// Lấy thông tin profile (yêu cầu xác thực)
router.get('/profile', auth, getProfile);

// Cập nhật thông tin cá nhân (yêu cầu xác thực)
router.put('/profile', auth, updateProfile);

// Lấy tất cả người dùng (chỉ cho admin)
router.get('/', auth, authAdmin, getAllUser);

// Xóa người dùng (chỉ cho admin)
router.delete('/:id', auth, authAdmin, deleteUser);

// Thêm admin (chỉ cho admin)
router.post('/add-admin', auth, authAdmin, addAdmin);

// Xóa admin (chỉ cho admin)
router.post('/remove-admin', auth, authAdmin, removeAdmin);

// Cập nhật vai trò (chỉ cho admin)
router.put('/update-role/:userId', auth, authAdmin, updateUserRole);

// Đổi mật khẩu (yêu cầu xác thực)
router.put('/change-password', auth, changePassword);

// Quên mật khẩu
router.post('/forgot-password', forgotPassword);

// Xác minh OTP
router.post('/verify-otp', verifyOTP);

// Đặt lại mật khẩu
router.post('/reset-password', resetPassword);

// Lấy số số  số lượng người dùng (chỉ cho admin)
router.get('/count', auth, authAdmin, getUserCount);

module.exports = router;