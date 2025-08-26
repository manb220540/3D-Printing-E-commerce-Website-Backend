const express = require('express');
const {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogCount
} = require('../controllers/blogController');
const auth = require('../middlewares/auth');
const authAdmin = require('../middlewares/authAdmin');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// --- Cấu hình Multer cho Blog Images ---
const blogStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/blogs/');
  },
  filename: (req, file, cb) => {
    cb(null, 'blog_' + Date.now() + path.extname(file.originalname));
  },
});

const uploadBlog = multer({ storage: blogStorage });

// --- Định nghĩa các Routes Blog ---

// Lấy tất cả bài blog (công khai)
router.get('/', getAllBlogs);

// Lấy số lượng bài blog (chỉ cho admin)
router.get('/count', auth, authAdmin, getBlogCount);

// Lấy bài blog theo ID (công khai)
router.get('/:id', getBlogById);

// Thêm bài blog mới (chỉ cho admin)
router.post('/', auth, authAdmin, uploadBlog.single('blogImage'), createBlog);

// Cập nhật bài blog (chỉ cho admin)
router.put('/:id', auth, authAdmin, uploadBlog.single('blogImage'), updateBlog);

// Xóa bài blog (chỉ cho admin)
router.delete('/:id', auth, authAdmin, deleteBlog);



module.exports = router;