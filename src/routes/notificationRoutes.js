const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { getNotifications, markAsRead } = require('../controllers/notificationController');
// --- Định nghĩa các Routes Notification ---

// Lấy tất cả thông báo (cần xác thực)

router.get('/', auth, getNotifications);
router.put('/:id/read', auth, markAsRead);


module.exports = router;