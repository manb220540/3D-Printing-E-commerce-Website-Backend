const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  createOrder,
  updateOrderStatus,
  getUserOrders,
  getAllOrders,
  getOrderDetails,
  getRevenue,
  getOrderCount,
  getRecentOrders,
  createCustomOrder,
  checkFile,
  updateOrderPriority
} = require('../controllers/orderController');
const auth = require('../middlewares/auth');
const authAdmin = require('../middlewares/authAdmin');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/print_files/');
  },
  filename: (req, file, cb) => {
    cb(null, 'print_' + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.stl', '.obj', '.3mf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file .STL, .OBJ, .3MF'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // Tăng giới hạn lên 50MB (50MB = 50 * 1024 * 1024 bytes)
  }
});

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

// Tạo đơn hàng in 3D tùy chỉnh (cần xác thực)
router.post('/custom', auth, upload.single('printFile'), createCustomOrder);

// Kiểm tra file in 3D (cần xác thực)
router.post('/check-file', auth, upload.single('printFile'), checkFile);

// Cập nhật độ ưu tiên đơn hàng (chỉ cho admin)
router.put('/priority', auth, authAdmin, updateOrderPriority);


module.exports = router;