const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// Hàm trợ giúp để xóa file
const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error('Lỗi khi xóa file:', filePath, err);
  });
};

exports.getAllBlogs = async (req, res) => {
  try {
    // Đảm bảo bạn SELECT cột 'author' ở đây
    const [rows] = await db.execute('SELECT id, title, content, image_url, author, created_at, updated_at FROM blogs ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy bài blog:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.getBlogById = async (req, res) => {
  const { id } = req.params;
  try {
    // Đảm bảo bạn SELECT cột 'author' ở đây
    const [rows] = await db.execute('SELECT id, title, content, image_url, author, created_at, updated_at FROM blogs WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Bài blog không tìm thấy' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Lỗi lấy bài blog theo ID:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.createBlog = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    // Sử dụng hàm deleteFile nếu có file
    if (req.file) deleteFile(req.file.path);
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { title, content, author } = req.body; // <-- Lấy 'author' từ req.body
  const imageUrl = req.file ? `/uploads/blogs/${req.file.filename}` : null;

  if (!title || !content || !author) { // <-- Kiểm tra 'author' là bắt buộc
    if (req.file) deleteFile(req.file.path); // Xóa file nếu thiếu dữ liệu
    return res.status(400).json({ message: 'Tiêu đề, nội dung và tác giả là bắt buộc.' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO blogs (title, content, image_url, author) VALUES (?, ?, ?, ?)', // <-- Cập nhật cột 'author'
      [title, content, imageUrl, author] // <-- Sử dụng biến 'author'
    );
    res.status(201).json({
      message: 'Bài blog đã được tạo',
      blogId: result.insertId,
      imageUrl: imageUrl,
      author: author // Thêm author vào response để frontend có thể cập nhật ngay
    });
  } catch (error) {
    console.error('Lỗi tạo bài blog:', error);
    if (req.file) deleteFile(req.file.path); // Xóa file do lỗi DB
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ khi tạo bài blog' });
  }
};

exports.updateBlog = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    if (req.file) deleteFile(req.file.path);
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { id } = req.params;
  const { title, content, author, oldImageUrl, clearImage } = req.body; // <-- Lấy 'author' từ req.body

  // Lấy đường dẫn ảnh hiện tại từ DB trước khi cập nhật
  let currentImageUrlFromDb = null;
  try {
    const [blogRows] = await db.execute('SELECT image_url FROM blogs WHERE id = ?', [id]);
    if (blogRows.length > 0) {
      currentImageUrlFromDb = blogRows[0].image_url;
    }
  } catch (error) {
    console.error('Lỗi khi lấy ảnh hiện tại từ DB:', error);
    if (req.file) deleteFile(req.file.path); // Xóa file mới upload nếu lỗi DB
    return res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật blog' });
  }

  let finalImageUrl = currentImageUrlFromDb;

  // Xử lý logic ảnh:
  if (req.file) { // Có ảnh mới được tải lên
    finalImageUrl = `/uploads/blogs/${req.file.filename}`;
    // Xóa ảnh cũ nếu có và ảnh mới không giống ảnh cũ
    if (currentImageUrlFromDb && currentImageUrlFromDb !== finalImageUrl) {
      const oldImagePath = path.join(__dirname, '../public', currentImageUrlFromDb);
      deleteFile(oldImagePath);
    }
  } else if (clearImage === 'true') { // Yêu cầu xóa ảnh hiện tại
    if (currentImageUrlFromDb) {
      const oldImagePath = path.join(__dirname, '../public', currentImageUrlFromDb);
      deleteFile(oldImagePath);
    }
    finalImageUrl = null; // Đặt URL ảnh về null
  } else { // Không có ảnh mới và không yêu cầu xóa, giữ ảnh cũ
    finalImageUrl = currentImageUrlFromDb; // Giữ nguyên ảnh hiện có
  }

  if (!title || !content || !author) { // <-- Kiểm tra 'author' là bắt buộc
    if (req.file) deleteFile(req.file.path); // Xóa file mới upload nếu thiếu dữ liệu
    return res.status(400).json({ message: 'Tiêu đề, nội dung và tác giả là bắt buộc.' });
  }

  try {
    const [result] = await db.execute(
      'UPDATE blogs SET title = ?, content = ?, image_url = ?, author = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', // <-- Cập nhật cột 'author'
      [title, content, finalImageUrl, author, id] // <-- Sử dụng biến 'author'
    );
    if (result.affectedRows === 0) {
      if (req.file) deleteFile(req.file.path); // Xóa file mới upload nếu blog không tồn tại
      return res.status(404).json({ message: 'Bài blog không tìm thấy để cập nhật' });
    }
    res.json({ message: 'Bài blog đã được cập nhật', imageUrl: finalImageUrl, author: author });
  } catch (error) {
    console.error('Lỗi cập nhật bài blog:', error);
    if (req.file) deleteFile(req.file.path); // Xóa file mới upload nếu có lỗi DB
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ khi cập nhật bài blog' });
  }
};

exports.deleteBlog = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { id } = req.params;
  let imageUrlToDelete = null;

  try {
    const [blogToDelete] = await db.execute('SELECT image_url FROM blogs WHERE id = ?', [id]);
    if (blogToDelete.length > 0) {
      imageUrlToDelete = blogToDelete[0].image_url;
    }

    const [result] = await db.execute('DELETE FROM blogs WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Bài blog không tìm thấy để xóa' });
    }

    if (imageUrlToDelete) {
      const imagePath = path.join(__dirname, '../public', imageUrlToDelete);
      deleteFile(imagePath); // Sử dụng hàm trợ giúp
    }

    res.json({ message: 'Bài blog đã được xóa' });
  } catch (error) {
    console.error('Lỗi xóa bài blog:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Lấy số lượng bài blog (chỉ cho admin)
exports.getBlogCount = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    const [result] = await db.execute('SELECT COUNT(*) as blogCount FROM blogs');
    res.json({ blogCount: result[0].blogCount || 0 });
  } catch (error) {
    console.error('Lỗi lấy số lượng blog:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};