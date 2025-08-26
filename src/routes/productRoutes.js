const express = require('express');
const { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, getProducts, getProductCount, } = require('../controllers/productController');
const auth = require('../middlewares/auth');
const authAdmin = require('../middlewares/authAdmin');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// --- Cấu hình Multer cho Product Images ---
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/products/');
  },
  filename: (req, file, cb) => {
    cb(null, 'product_' + Date.now() + path.extname(file.originalname));
  },
});

const uploadProduct = multer({ storage: productStorage });

// --- Định nghĩa các Routes Product ---

// Lấy số lượng sản phẩm (chỉ cho admin)
router.get('/count', auth, authAdmin, getProductCount);

// Lấy tất cả sản phẩm (công khai)
router.get('/', getAllProducts);

// Lấy sản phẩm theo ID (công khai)
router.get('/:id', getProductById);

// Lấy sản phẩm theo tìm kiếm (công khai)
router.get('/search', getProducts);

// Thêm sản phẩm mới (chỉ cho admin)
router.post('/', auth, authAdmin, uploadProduct.single('productImage'), createProduct);

// Cập nhật sản phẩm (chỉ cho admin)
router.put('/:id', auth, authAdmin, uploadProduct.single('productImage'), updateProduct);

// Xóa sản phẩm (chỉ cho admin)
router.delete('/:id', auth, authAdmin, deleteProduct);



module.exports = router;