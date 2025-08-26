const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// Hàm trợ giúp để xóa file - Đảm bảo hàm này được đặt ở đầu file
const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error('Lỗi khi xóa file:', filePath, err);
  });
};

exports.getAllProducts = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM products');
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Sản phẩm không tìm thấy' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm theo ID:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.createProduct = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    // Sử dụng deleteFile
    if (req.file) deleteFile(req.file.path);
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { name, description, price, stock } = req.body;
  const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

  if (!name || !price || !stock) { // Kiểm tra các trường bắt buộc
    // Sử dụng deleteFile
    if (req.file) deleteFile(req.file.path);
    return res.status(400).json({ message: 'Tên, giá và số lượng tồn kho là bắt buộc.' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO products (name, description, price, image_url, stock) VALUES (?, ?, ?, ?, ?)',
      [name, description, parseFloat(price), imageUrl, parseInt(stock, 10)]
    );
    res.status(201).json({
      message: 'Sản phẩm đã được tạo',
      productId: result.insertId,
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Lỗi tạo sản phẩm:', error);
    // Sử dụng deleteFile
    if (req.file) deleteFile(req.file.path);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ khi tạo sản phẩm' });
  }
};

exports.updateProduct = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    // Sử dụng deleteFile
    if (req.file) deleteFile(req.file.path);
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { id } = req.params;
  // Thêm oldImageUrl và clearImage để tương đồng với blogController
  const { name, description, price, stock, oldImageUrl, clearImage } = req.body;

  // Lấy đường dẫn ảnh hiện tại từ DB trước khi cập nhật
  let currentImageUrlFromDb = null;
  try {
    const [productRows] = await db.execute('SELECT image_url FROM products WHERE id = ?', [id]);
    if (productRows.length > 0) {
      currentImageUrlFromDb = productRows[0].image_url;
    }
  } catch (error) {
    console.error('Lỗi khi lấy ảnh hiện tại từ DB:', error);
    // Sử dụng deleteFile
    if (req.file) deleteFile(req.file.path);
    return res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật sản phẩm' });
  }

  let finalImageUrl = currentImageUrlFromDb; // Mặc định giữ ảnh cũ

  // Xử lý logic ảnh tương đồng với blogController
  if (req.file) { // Có ảnh mới được tải lên
    finalImageUrl = `/uploads/products/${req.file.filename}`;
    // Xóa ảnh cũ nếu có và ảnh mới không giống ảnh cũ
    if (currentImageUrlFromDb && currentImageUrlFromDb !== finalImageUrl) {
      const oldImagePath = path.join(__dirname, '../public', currentImageUrlFromDb);
      deleteFile(oldImagePath);
    }
  } else if (clearImage === 'true') { // Yêu cầu xóa ảnh hiện tại từ frontend
    if (currentImageUrlFromDb) {
      const oldImagePath = path.join(__dirname, '../public', currentImageUrlFromDb);
      deleteFile(oldImagePath);
    }
    finalImageUrl = null; // Đặt URL ảnh về null
  } else {
    // Nếu không có file mới và không yêu cầu xóa, finalImageUrl vẫn là currentImageUrlFromDb
    // Bạn có thể không cần `oldImageUrl` từ frontend nữa nếu logic này là đủ
    // và frontend chỉ đơn giản gửi `clearImage = 'true'` khi muốn xóa ảnh.
    // Nếu oldImageUrl từ frontend có thể khác với currentImageUrlFromDb,
    // và bạn muốn ưu tiên nó trong trường hợp không có file mới, bạn cần điều chỉnh logic.
    // Hiện tại, nó ưu tiên DB và sau đó là file mới/clearImage.
  }

  if (!name || !price || !stock) { // Kiểm tra các trường bắt buộc
    // Sử dụng deleteFile
    if (req.file) deleteFile(req.file.path);
    return res.status(400).json({ message: 'Tên, giá và số lượng tồn kho là bắt buộc.' });
  }

  try {
    const [result] = await db.execute(
      'UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, parseFloat(price), finalImageUrl, parseInt(stock, 10), id]
    );
    if (result.affectedRows === 0) {
      // Sử dụng deleteFile
      if (req.file) deleteFile(req.file.path);
      return res.status(404).json({ message: 'Sản phẩm không tìm thấy để cập nhật' });
    }
    res.json({ message: 'Sản phẩm đã được cập nhật', imageUrl: finalImageUrl });
  } catch (error) {
    console.error('Lỗi cập nhật sản phẩm:', error);
    // Sử dụng deleteFile
    if (req.file) deleteFile(req.file.path);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ khi cập nhật sản phẩm' });
  }
};

exports.deleteProduct = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { id } = req.params;
  let imageUrlToDelete = null;

  try {
    const [productToDelete] = await db.execute('SELECT image_url FROM products WHERE id = ?', [id]);
    if (productToDelete.length > 0) {
      imageUrlToDelete = productToDelete[0].image_url;
    }

    const [result] = await db.execute('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sản phẩm không tìm thấy để xóa' });
    }

    if (imageUrlToDelete) {
      const imagePath = path.join(__dirname, '../public', imageUrlToDelete);
      deleteFile(imagePath); // Sử dụng hàm trợ giúp deleteFile
    }

    res.json({ message: 'Sản phẩm đã được xóa' });
  } catch (error) {
    console.error('Lỗi xóa sản phẩm:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};



exports.getProducts = async (req, res) => {
  try {
    const search = req.query.search || '';
    let query = 'SELECT * FROM products WHERE stock > 0';
    let queryParams = [];

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      queryParams = [`%${search}%`, `%${search}%`];
    }

    const [products] = await db.execute(query, queryParams);
    res.json(products);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// lấy số lượng sản phẩm
exports.getProductCount = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    const [result] = await db.execute('SELECT COUNT(*) as productCount FROM products');
    res.json({ productCount: result[0].productCount || 0 });
  } catch (error) {
    console.error('Lỗi lấy số lượng sản phẩm:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};