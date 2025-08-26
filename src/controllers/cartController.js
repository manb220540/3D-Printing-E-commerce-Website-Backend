const db = require('../config/db');

// Lấy giỏ hàng của người dùng (hoặc tạo mới nếu chưa có)
exports.getOrCreateCart = async (req, res) => {
  const userId = req.user.id; // Only authenticated users

  try {
    let cart;
    // Check for existing active cart for authenticated user
    const [rows] = await db.execute('SELECT * FROM carts WHERE user_id = ? AND status = "active"', [userId]);
    cart = rows[0];
    if (!cart) {
      console.log("Creating new cart for user ID:", userId); // Debug log
      const [result] = await db.execute('INSERT INTO carts (user_id, status) VALUES (?, ?)', [userId, 'active']);
      cart = { id: result.insertId, user_id: userId, status: 'active' };
    }

    const [items] = await db.execute(
      'SELECT ci.id, ci.product_id, p.name, p.price AS current_price, p.image_url, ci.quantity, ci.price FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.cart_id = ?',
      [cart.id]
    );
    res.json({ cart, items });
  } catch (error) {
    console.error('Lỗi lấy/tạo giỏ hàng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Thêm sản phẩm vào giỏ hàng
exports.addItemToCart = async (req, res) => {
  const { cartId, productId, quantity } = req.body;
  const userId = req.user ? req.user.id : null;

  try {
    // Validate cartId or create a new cart for authenticated user
    let finalCartId = cartId;
    if (!cartId && userId) {
      const [rows] = await db.execute('SELECT * FROM carts WHERE user_id = ? AND status = "active"', [userId]);
      let cart = rows[0];
      if (!cart) {
        const [result] = await db.execute('INSERT INTO carts (user_id, status) VALUES (?, ?)', [userId, 'active']);
        finalCartId = result.insertId;
      } else {
        finalCartId = cart.id;
      }
    } else if (!cartId && !userId) {
      // Create new guest cart if no cartId provided
      const [result] = await db.execute('INSERT INTO carts (user_id, status) VALUES (NULL, ?)', ['active']);
      finalCartId = result.insertId;
    }

    if (!finalCartId) {
      return res.status(400).json({ message: 'Thiếu cartId và không thể tạo giỏ hàng' });
    }

    // Lấy thông tin sản phẩm để lấy giá hiện tại
    const [productRows] = await db.execute('SELECT price FROM products WHERE id = ?', [productId]);
    if (productRows.length === 0) {
      return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    }
    const productPrice = productRows[0].price;
    // Kiểm tra xem nếu sản phẩm còn hàng trong kho nếu không trả về 404 sản phẩm không còn hàng
    const [stockRows] = await db.execute('SELECT stock FROM products WHERE id = ?', [productId]);
    if (stockRows.length === 0 || stockRows[0].stock <= 0) {
      return res.status(404).json({ message: 'Sản phẩm không còn hàng' });
    }

    // Kiểm tra số lượng yêu cầu có hợp lệ không
    if (quantity <= 0) {
      return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });
    }
    // Kiểm tra xem số lượng yêu cầu có vượt quá số lượng trong kho không
    if (quantity > stockRows[0].stock) {
      return res.status(400).json({ message: 'Số lượng yêu cầu vượt quá số lượng trong kho' });
    }

    // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
    const [existingItem] = await db.execute('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?', [finalCartId, productId]);

    if (existingItem.length > 0) {
      await db.execute('UPDATE cart_items SET quantity = quantity + ? WHERE cart_id = ? AND product_id = ?', [quantity, finalCartId, productId]);
      res.json({ message: 'Cập nhật số lượng sản phẩm trong giỏ hàng' });
    } else {
      await db.execute('INSERT INTO cart_items (cart_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [
        finalCartId,
        productId,
        quantity,
        productPrice,
      ]);
      res.status(201).json({ message: 'Sản phẩm đã được thêm vào giỏ hàng', cartId: finalCartId });
    }
  } catch (error) {
    console.error('Lỗi thêm sản phẩm vào giỏ:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Cập nhật số lượng sản phẩm trong giỏ hàng
exports.updateCartItemQuantity = async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  try {
    if (quantity <= 0) {
      await db.execute('DELETE FROM cart_items WHERE id = ?', [itemId]);
      return res.json({ message: 'Sản phẩm đã bị xóa khỏi giỏ hàng' });
    }
    const [result] = await db.execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, itemId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Mặt hàng trong giỏ không tìm thấy' });
    }
    res.json({ message: 'Cập nhật số lượng thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật số lượng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Xóa sản phẩm khỏi giỏ hàng
exports.removeCartItem = async (req, res) => {
  const { itemId } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM cart_items WHERE id = ?', [itemId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Mặt hàng trong giỏ không tìm thấy để xóa' });
    }
    res.json({ message: 'Sản phẩm đã bị xóa khỏi giỏ hàng' });
  } catch (error) {
    console.error('Lỗi xóa sản phẩm khỏi giỏ:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};