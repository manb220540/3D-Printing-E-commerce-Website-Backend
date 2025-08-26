const express = require('express');
const { getOrCreateCart, addItemToCart, updateCartItemQuantity, removeCartItem } = require('../controllers/cartController');
const auth = require('../middlewares/auth'); // Cần auth cho giỏ hàng của người dùng đã đăng nhập
const router = express.Router();

// Lấy/tạo giỏ hàng (sử dụng auth nếu có token, không bắt buộc)
router.get('/', auth, getOrCreateCart); // /api/cart?cartId=...

// Thêm sản phẩm vào giỏ hàng
router.post('/items', auth, addItemToCart); // /api/cart/items

// Cập nhật số lượng (dùng ID của cart_item)
router.put('/items/:itemId', auth, updateCartItemQuantity); // /api/cart/items/:itemId

// Xóa sản phẩm khỏi giỏ hàng (dùng ID của cart_item)
router.delete('/items/:itemId',auth, removeCartItem); // /api/cart/items/:itemId

module.exports = router;