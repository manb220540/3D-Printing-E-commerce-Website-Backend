const db = require('../config/db');

exports.getNotifications = async (req, res) => {
  try{
    const userId = req.user.id; // Lấy ID người dùng từ token
    const [notifications] = await db.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json(notifications);
  } catch (error) {
    console.error('Lỗi lấy thông báo:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });  

  }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id; // Lấy ID người dùng từ token
        await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Thông báo đã được đánh dấu là đã đọc' });
    } catch (error) {
        console.error('Lỗi đánh dấu thông báo là đã đọc:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
 
};