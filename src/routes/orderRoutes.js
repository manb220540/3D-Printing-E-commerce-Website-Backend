const express = require('express');
const {
  createOrder,
  updateOrderStatus,
  getUserOrders,
  getAllOrders,
  getOrderDetails,
  getRevenue,
  getOrderCount,
  getRecentOrders
} = require('../controllers/orderController');
const auth = require('../middlewares/auth');
const authAdmin = require('../middlewares/authAdmin');
const router = express.Router();

// --- Định nghĩa các Routes Order ---

// Lấy các đơn hàng gần đây (chỉ cho admin)
router.get('/recent', auth, authAdmin, getRecentOrders);

// Lấy doanh thu (chỉ cho admin)
router.get('/revenue', auth, authAdmin, getRevenue);

// Lấy số lượng đơn hàng (chỉ cho admin)
router.get('/count', auth, authAdmin, getOrderCount);

// Lấy tất cả đơn hàng (chỉ cho admin)
router.get('/', auth, authAdmin, getAllOrders);

// Tạo đơn hàng mới (cần xác thực)
router.post('/', auth, createOrder);

// / Cập nhật trạng thái đơn hàng (cho cả admin và người dùng sở hữu)
router.put('/:id/status', auth, updateOrderStatus);

// Lấy đơn hàng của người dùng (cần xác thực)
router.get('/user', auth, getUserOrders);

// Lấy chi tiết đơn hàng (cần xác thực)
router.get('/:id', auth, getOrderDetails);


module.exports = router;