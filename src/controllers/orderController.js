const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { STLLoader } = require('../utils/STLLoader');




// Tạo đơn hàng mới
exports.createOrder = async (req, res) => {
  if (!req.user || req.user.role !== 'user') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { cartId, shippingAddress, phoneNumber, paymentMethod } = req.body;
  const userId = req.user.id;

  try {
    console.log('Creating order with cartId:', cartId, 'for userId:', userId); // Debug log
    // Kiểm tra xem giỏ hàng có tồn tại không
    const [cart] = await db.execute('SELECT * FROM carts WHERE id = ? AND user_id = ? AND status = "active"', [cartId, userId]);
    if (cart.length === 0) {
      return res.status(404).json({ message: 'Giỏ hàng không tìm thấy hoặc không hợp lệ' });
    }

    // Lấy các sản phẩm trong giỏ hàng
    const [cartItems] = await db.execute(
      'SELECT product_id, quantity, price FROM cart_items WHERE cart_id = ?',
      [cartId]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // Tính tổng tiền dựa trên các sản phẩm trong giỏ hàng
    const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Tạo đơn hàng mới và lấy order_code
    const [result] = await db.execute(
      'INSERT INTO orders (user_id, total_amount, status, shipping_address, phone_number, payment_method, payment_status, order_code) VALUES (?, ?, ?, ?, ?, ?, ?, UUID())',
      [userId, totalAmount, 'confirmed', shippingAddress, phoneNumber, paymentMethod, 'unpaid']
    );
    const orderId = result.insertId;

    // Lấy order_code từ đơn hàng vừa tạo
    const [newOrder] = await db.execute('SELECT order_code FROM orders WHERE id = ?', [orderId]);
    const orderCode = newOrder[0].order_code;

    // Thêm các sản phẩm vào bảng order_items
    const orderItems = cartItems.map(item => [orderId, item.product_id, item.quantity, item.price]);
    if (orderItems.length > 0) {
      await db.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?', [orderItems]);
    }

    // Cập nhật hàng trong kho
    for (const item of cartItems) {
      await db.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    // Xóa giỏ hàng và item sau khi tạo đơn hàng
    await db.execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    await db.execute('UPDATE carts SET status = ? WHERE id = ?', ['ordered', cartId]);
    console.log('Cart cleared and status updated for cartId:', cartId); // Debug log

    // Thêm thông báo thành công vào notification sử dụng order_code
    await db.execute(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [userId, `Đơn hàng ${orderCode} đã được xác nhận vào ${new Date().toLocaleString('vi-VN')}.`]
    );
    // Lấy tất cả admin để thông báo
    const [admins] = await db.execute('SELECT id FROM users WHERE role = ?', ['admin']);
    const adminIds = admins.map(admin => admin.id);
    if (adminIds.length > 0) {
      const adminNotifications = adminIds.map(adminId =>
        db.execute(
          'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
          [adminId, `Có đơn hàng mới ${orderCode} từ người dùng ${req.user.username} vào ${new Date().toLocaleString('vi-VN')}.`]
        )
      );
      await Promise.all(adminNotifications);
    }

    res.status(201).json({ message: 'Đơn hàng đã được tạo thành công', orderId });
  } catch (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ', details: error.message });
  }
};

// Cập nhật trạng thái đơn hàng
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    // Kiểm tra xem đơn hàng có tồn tại không
    const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Đơn hàng không tìm thấy' });
    }

    const order = orders[0];
    const isAdmin = req.user.role === 'admin';
    const isOwner = order.user_id === req.user.id;

    // Kiểm tra quyền truy cập
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
    }

    const currentStatus = order.status;
    const validTransitions = {
      'confirmed': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': [],
    };

    // Users can only cancel their own orders if still 'confirmed'
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Bạn chỉ có thể hủy đơn hàng của chính mình.' });
    }

    if (isOwner && status !== 'cancelled') {
      return res.status(403).json({ message: 'Người dùng chỉ có thể hủy đơn hàng.' });
    }

    if (!validTransitions[currentStatus].includes(status) && !(isAdmin && status === 'confirmed')) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }

    // Nếu người dùng hủy đơn hàng và trạng thái hiện tại là 'confirmed', hoàn lại số lượng trong kho
    if (isOwner && status === 'cancelled' && currentStatus === 'confirmed') {
      const [orderItems] = await db.execute(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );
      for (const item of orderItems) {
        await db.execute(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }
    // Nếu admin hủy đơn hàng và trạng thái hiện tại là 'confirmed', hoàn lại số lượng trong kho
    if (isAdmin && status === 'cancelled' && currentStatus === 'confirmed') {
      const [orderItems] = await db.execute(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );
      for (const item of orderItems) {
        await db.execute(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Cập nhật trạng thái đơn hàng
    await db.execute('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    await db.execute('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [id, status, note || null]);

    // Lấy order_code để dùng trong thông báo
    const [updatedOrder] = await db.execute('SELECT order_code FROM orders WHERE id = ?', [id]);
    const orderCode = updatedOrder[0].order_code;

    // Thêm thông báo cho người dùng sử dụng order_code
    await db.execute(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [order.user_id, `Đơn hàng ${orderCode} đã được cập nhật sang trạng thái "${status}" vào ${new Date().toLocaleString('vi-VN')}.`]
    );
    // Nếu người dùng (không phải admin) cập nhật trạng thái, thông báo cho admin
    if (!isAdmin) {
      const [admins] = await db.execute('SELECT id FROM users WHERE role = ?', ['admin']);
      const adminIds = admins.map(admin => admin.id);
      if (adminIds.length > 0) {
        const adminNotifications = adminIds.map(adminId =>
          db.execute(
            'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
            [adminId, `Đơn hàng ${orderCode} đã được ${req.user.username} cập nhật sang trạng thái "${status}" vào ${new Date().toLocaleString('vi-VN')}.`]
          )
        );
        await Promise.all(adminNotifications);
      }
    }

    res.json({ message: 'Trạng thái đơn hàng đã được cập nhật thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Lấy đơn hàng của người dùng
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    // const [orders] = await db.execute(
    //   'SELECT id, total_amount, status, shipping_address, phone_number, order_date, updated_at, order_code FROM orders WHERE user_id = ?',
    //   [userId]
    // );
    const [orders] = await db.execute(
      `SELECT o.id, o.user_id, o.total_amount, o.status, o.shipping_address, 
              o.phone_number, o.order_date, o.updated_at, o.order_code, 
              u.username,
              pf.file_path, pf.file_type,
              pc.material, pc.color, pc.layer_height, pc.infill, pc.size_x, pc.size_y, pc.size_z
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN print_files pf ON o.id = pf.order_id
       LEFT JOIN print_customizations pc ON o.id = pc.order_id
       WHERE o.user_id = ?
       ORDER BY o.order_date DESC`,
      [userId]
    );
    res.json(orders);
  } catch (error) {
    console.error('Lỗi lấy đơn hàng của người dùng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Lấy tất cả đơn hàng
// exports.getAllOrders = async (req, res) => {
//   if (!req.user || req.user.role !== 'admin') {
//     return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
//   }
//   try {
//     const [orders] = await db.execute(
//       'SELECT o.id, o.user_id, o.total_amount, o.status, o.shipping_address, o.phone_number, o.order_date, o.updated_at, o.order_code, u.username FROM orders o JOIN users u ON o.user_id = u.id'
//     );
//     if (orders.length === 0) {
//       return res.json([]); // Return empty array if no orders
//     }
//     res.json(orders);
//   } catch (error) {
//     console.error('Lỗi lấy tất cả đơn hàng:', error);
//     res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
//   }
// };
// Lấy tất cả đơn hàng
exports.getAllOrders = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    const [orders] = await db.execute(
      `SELECT o.id, o.user_id, o.total_amount, o.status, o.shipping_address, 
              o.phone_number, o.order_date, o.updated_at, o.order_code, 
              u.username,
              pf.file_path, pf.file_type,
              pc.material, pc.color, pc.layer_height, pc.infill, pc.size_x, pc.size_y, pc.size_z
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN print_files pf ON o.id = pf.order_id
       LEFT JOIN print_customizations pc ON o.id = pc.order_id
       ORDER BY o.order_date DESC`
    );
    res.json(orders);
  } catch (error) {
    console.error('Lỗi lấy tất cả đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};


// Lấy chi tiết đơn hàng
exports.getOrderDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const [order] = await db.execute(
      'SELECT o.id, o.user_id, o.total_amount, o.status, o.shipping_address, o.phone_number, o.order_date, o.updated_at, o.order_code, u.username FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?',
      [id]
    );
    if (!order.length) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    const [orderItems] = await db.execute(
      'SELECT oi.quantity, oi.price, p.name, p.image_url FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
      [id]
    );
    res.json({ order: order[0], items: orderItems });
  } catch (error) {
    console.error('Lỗi lấy chi tiết đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Lấy doanh thu
exports.getRevenue = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    const [result] = await db.execute(
      'SELECT SUM(total_amount) as totalRevenue FROM orders WHERE status = ?',
      ['delivered']
    );
    const totalRevenue = result[0].totalRevenue || 0;
    res.json({ totalRevenue });
  } catch (error) {
    console.error('Lỗi lấy doanh thu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Lấy số lượng đơn hàng
exports.getOrderCount = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    console.log('Fetching order count for status: delivered'); // Debug log
    const [result] = await db.execute('SELECT COUNT(*) as orderCount FROM orders WHERE status = ?', ['delivered']);
    console.log('Order count query result:', result); // Debug log
    const orderCount = result[0].orderCount || 0; // Default to 0 if no orders found
    console.log('Calculated orderCount:', orderCount); // Debug log
    res.json({ orderCount });
  } catch (error) {
    console.error('Lỗi lấy số lượng đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// lay don hang
exports.getRecentOrders = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    const [orders] = await db.execute(
      'SELECT o.id, o.order_code, o.total_amount, o.status, u.username FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.order_date DESC LIMIT 5'
    );
    res.json(orders);
  } catch (error) {
    console.error('Lỗi lấy đơn hàng gần đây:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.createCustomOrder = async (req, res) => {
  console.log('Request file:', req.file); // Thêm log này
  console.log('Request body:', req.body); // Kiểm tra body
  if (!req.user || req.user.role !== 'user') {
    if (req.file) fs.unlinkSync(req.file.path); // Xóa file nếu không có quyền
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { shippingAddress, phoneNumber, paymentMethod, material, color, layerHeight, infill, sizeX, sizeY, sizeZ } = req.body;
  const file = req.file;

  try {
    if (!file) return res.status(400).json({ message: 'Vui lòng tải lên file in 3D.' });

    // Tính toán giá tạm thời (cần điều chỉnh theo công thức thực tế)
    const basePrice = 10.0; // Giá cơ bản
    const materialCost = { PLA: 1.0, ABS: 1.5, PETG: 1.2 }[material] || 1.0;
    const weightEstimate = (sizeX * sizeY * sizeZ) / 1000; // Ước lượng trọng lượng (cm³ -> kg)
    const printTimeEstimate = (sizeZ / layerHeight) * 10; // Ước lượng thời gian in (phút)
    const totalPrice = basePrice + (weightEstimate * materialCost * 5) + (printTimeEstimate * 0.1);

    // Tạo đơn hàng mới
    const [result] = await db.execute(
      'INSERT INTO orders (user_id, total_amount, status, shipping_address, phone_number, payment_method, payment_status, order_code) VALUES (?, ?, ?, ?, ?, ?, ?, UUID())',
      [req.user.id, totalPrice, 'confirmed', shippingAddress, phoneNumber, paymentMethod, 'unpaid']
    );
    const orderId = result.insertId;
    const [newOrder] = await db.execute('SELECT order_code FROM orders WHERE id = ?', [orderId]);
    const orderCode = newOrder[0].order_code;

    // Lưu file in
    const filePath = `/uploads/print_files/${file.filename}`;
    await db.execute(
      'INSERT INTO print_files (order_id, file_path, file_type) VALUES (?, ?, ?)',
      [orderId, filePath, path.extname(file.originalname).toLowerCase()]
    );

    // Lưu tùy chỉnh
    await db.execute(
      'INSERT INTO print_customizations (order_id, material, color, layer_height, infill, size_x, size_y, size_z) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, material, color, layerHeight, infill, sizeX, sizeY, sizeZ]
    );

    // Thêm thông báo
    await db.execute(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [req.user.id, `Đơn hàng in 3D ${orderCode} đã được tạo vào ${new Date().toLocaleString('vi-VN')}.`]
    );
    const [admins] = await db.execute('SELECT id FROM users WHERE role = ?', ['admin']);
    const adminIds = admins.map(admin => admin.id);
    if (adminIds.length > 0) {
      const adminNotifications = adminIds.map(adminId =>
        db.execute(
          'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
          [adminId, `Có đơn hàng in 3D mới ${orderCode} từ ${req.user.username} vào ${new Date().toLocaleString('vi-VN')}.`]
        )
      );
      await Promise.all(adminNotifications);
    }

    res.status(201).json({ message: 'Đơn hàng in 3D đã được tạo', orderId, totalPrice });
  } catch (error) {
    console.error('Lỗi tạo đơn hàng in 3D:', error);
    if (req.file) fs.unlinkSync(req.file.path); // Xóa file nếu lỗi
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ', details: error.message });
  }
};

// Kiểm tra file STL hợp lệ
exports.checkFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file để kiểm tra.' });

  try {
    const filePath = req.file.path;
    const arrayBuffer = fs.readFileSync(filePath);
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (extension !== '.stl') {
      throw new Error('Chỉ chấp nhận file .STL.');
    }

    const loader = new STLLoader();
    loader.parse(arrayBuffer, () => {}, (error) => {
      throw new Error(error.message);
    });

    res.json({ message: 'File hợp lệ.' });
  } catch (error) {
    console.error('Lỗi kiểm tra file:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Lỗi kiểm tra file: ' + error.message });
  }
};
exports.updateOrderPriority = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin có quyền.' });

  const { id, priority } = req.body;
  try {
    await db.execute('UPDATE orders SET priority = ? WHERE id = ?', [priority, id]);
    res.json({ message: 'Đã cập nhật ưu tiên.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
  }
};