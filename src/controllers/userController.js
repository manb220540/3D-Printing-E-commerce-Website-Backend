const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateOTP, sendVerificationEmail } = require('../config/email');

// In-memory store for failed login attempts (for demo; replace with database/Redis in production)
const failedLoginAttempts = {};

const FAILED_ATTEMPTS_THRESHOLD = 5;
const OTP_EXPIRY_MINUTES = 10;

// Đăng ký người dùng mới
exports.register = async (req, res) => {
  const { username, email, password, fullName, address, phoneNumber } = req.body;
  try {
    const [existingUser] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Tên đăng nhập hoặc Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, full_name, address, phone_number, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, fullName, address, phoneNumber, 'user']
    );
    res.status(201).json({ message: 'Đăng ký người dùng thành công', userId: result.insertId });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Đăng nhập người dùng
exports.login = async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip; // Sử dụng IP để theo dõi (có thể thay bằng session ID)

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (!user) {
      failedLoginAttempts[ip] = (failedLoginAttempts[ip] || 0) + 1;
      if (failedLoginAttempts[ip] >= FAILED_ATTEMPTS_THRESHOLD) {
        return res.status(401).json({ message: 'Tài khoản bị khóa tạm thời. Vui lòng đặt lại mật khẩu.' });
      }
      return res.status(400).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      failedLoginAttempts[ip] = (failedLoginAttempts[ip] || 0) + 1;
      if (failedLoginAttempts[ip] >= FAILED_ATTEMPTS_THRESHOLD) {
        return res.status(401).json({ message: 'Tài khoản bị khóa tạm thời. Vui lòng đặt lại mật khẩu.' });
      }
      return res.status(400).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    // Reset failed attempts on successful login
    delete failedLoginAttempts[ip];

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '14d' }
    );
    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name, role: user.role }
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Lấy thông tin profile người dùng
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, username, email, full_name, address, phone_number, role FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Lỗi lấy profile:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Cập nhật thông tin cá nhân người dùng
exports.updateProfile = async (req, res) => {
  try {
    const { full_name, address, phone_number } = req.body;
    const [rows] = await db.execute('SELECT id FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' });
    }

    const [result] = await db.execute(
      'UPDATE users SET full_name = ?, address = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [full_name || null, address || null, phone_number || null, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'Không có thay đổi nào được thực hiện' });
    }

    const [updatedUser] = await db.execute(
      'SELECT id, username, email, full_name, address, phone_number, role FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(updatedUser[0]);
  } catch (error) {
    console.error('Lỗi cập nhật profile:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.getAllUser = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    const [rows] = await db.execute('SELECT id, username, email, full_name, address, phone_number, role FROM users');
    res.json(rows);
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.deleteUser = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy để xóa' });
    }
    res.json({ message: 'Người dùng đã được xóa' });
  } catch (error) {
    console.error('Lỗi xóa người dùng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.addAdmin = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { userId } = req.body;
  try {
    const [userRows] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' });
    }

    await db.execute('UPDATE users SET role = ? WHERE id = ?', ['admin', userId]);
    res.json({ message: 'Người dùng đã được nâng cấp thành admin' });
  } catch (error) {
    console.error('Lỗi thêm admin:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.removeAdmin = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { userId } = req.body;
  try {
    const [userRows] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' });
    }

    await db.execute('UPDATE users SET role = ? WHERE id = ?', ['user', userId]);
    res.json({ message: 'Người dùng đã được hạ cấp thành user' });
  } catch (error) {
    console.error('Lỗi xóa admin:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.updateUserRole = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }

  const { userId } = req.params;
  const { role } = req.body;

  try {
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: 'ID người dùng không hợp lệ.' });
    }
    if (role === undefined || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Vai trò không hợp lệ. Chỉ chấp nhận "user" hoặc "admin".' });
    }

    const [userRows] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' });
    }

    await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    res.json({ message: `Vai trò của người dùng đã được cập nhật thành ${role}` });
  } catch (error) {
    console.error('Lỗi cập nhật vai trò:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const [userRows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy' });
    }
    const user = userRows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedNewPassword, req.user.id]);

    res.json({ message: 'Mật khẩu đã được cập nhật thành công' });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Bắt đầu quy trình quên mật khẩu
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const ip = req.ip;

  try {
    const [userRows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Email không tồn tại' });
    }
    const user = userRows[0];

    // Kiểm tra số lần đăng nhập thất bại
    if (failedLoginAttempts[ip] && failedLoginAttempts[ip] < FAILED_ATTEMPTS_THRESHOLD) {
      return res.status(400).json({ message: `Vui lòng thử lại sau ${FAILED_ATTEMPTS_THRESHOLD - failedLoginAttempts[ip]} lần đăng nhập thất bại.` });
    }

    // Tạo và gửi OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000); // Hết hạn sau 10 phút

    await db.execute(
      'UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?',
      [otp, otpExpiry, email]
    );

    await sendVerificationEmail(email, otp);

    // Reset failed attempts after sending OTP
    delete failedLoginAttempts[ip];

    res.json({ message: 'Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra.' });
  } catch (error) {
    console.error('Lỗi quên mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Xác minh OTP
exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const [userRows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Email không tồn tại' });
    }
    const user = userRows[0];

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Mã OTP không đúng' });
    }

    const currentTime = new Date();
    if (currentTime > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: 'Mã OTP đã hết hạn' });
    }

    res.json({ message: 'Mã OTP hợp lệ. Vui lòng đặt mật khẩu mới.' });
  } catch (error) {
    console.error('Lỗi xác minh OTP:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Đặt lại mật khẩu
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const [userRows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Email không tồn tại' });
    }
    const user = userRows[0];

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Mã OTP không đúng' });
    }

    const currentTime = new Date();
    if (currentTime > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: 'Mã OTP đã hết hạn' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.execute(
      'UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
      [hashedNewPassword, email]
    );

    res.json({ message: 'Mật khẩu đã được đặt lại thành công' });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

// Lấy số lượng người dùng
exports.getUserCount = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
  }
  try {
    const [result] = await db.execute('SELECT COUNT(*) as userCount FROM users');
    res.json({ userCount: result[0].userCount || 0 });
  } catch (error) {
    console.error('Lỗi lấy số lượng người dùng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};