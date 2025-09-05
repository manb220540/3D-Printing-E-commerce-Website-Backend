require('dotenv').config();
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const fs = require('fs');


// Cấu hình multer để lưu file vào thư mục uploads/ trong server/
const upload = multer({ dest: 'uploads/' });

// Khởi tạo GoogleGenerativeAI với API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Khởi tạo mô hình với tên mô hình
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
// const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

// Prompt hướng dẫn
const systemPrompt = `
Bạn là một trợ lý AI thân thiện, thông minh, và hài hước, được thiết kế để giúp người dùng giải đáp mọi thắc mắc. Bạn có tên là trợ lý Smart.
Hãy trả lời bằng tiếng Việt, với giọng điệu vui vẻ và dễ hiểu. 
Nếu câu hỏi không rõ ràng, hãy hỏi lại để làm rõ trước khi trả lời. 
Không trả lời các câu hỏi liên quan đến nội dung nhạy cảm, chính trị, hoặc thông tin cá nhân. 
Cố gắng giữ câu trả lời ngắn gọn, dưới 100 từ, trừ khi người dùng yêu cầu giải thích chi tiết.
`;

// Lịch sử trò chuyện
// let conversationHistory = [];

router.post('/chat', async (req, res) => {
    const { message, history } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Tin nhắn không được để trống.' });
    }

    try {
        // Ghép lịch sử từ client gửi lên
        const historyText = (history || [])
            .map(msg => `${msg.sender === 'user' ? 'Người dùng' : 'Trợ lý'}: ${msg.text}`)
            .join('\n');

        const fullPrompt = `${systemPrompt}\n${historyText}\nNgười dùng: ${message}\nTrợ lý:`;

        const result = await model.generateContent(fullPrompt);
        const response = result.response.text();

        res.json({ response });
    } catch (error) {
        console.error('Lỗi route /chat:', error);
        if (error.status === 429) {
            res.status(429).json({ error: 'Quá số lượt sử dụng, thử lại sau.' });
        } else {
            res.status(500).json({ error: 'Đã có lỗi xảy ra.' });
        }
    }
});
router.post('/describe-image', upload.single('image'), async (req, res) => {
    if (!req.file) {
        console.log('Error: Vui lòng gửi một hình ảnh.');
        return res.status(400).json({ error: 'Vui lòng gửi một hình ảnh.' });
    }

    try {
        console.log('File received:', req.file);
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString('base64');
        console.log('Base64 image length:', base64Image.length);

        fs.unlinkSync(req.file.path);

        const result = await model.generateContent([
            { text: 'Mô tả hình ảnh này bằng tiếng Việt một cách chi tiết và vui vẻ.' },
            { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
        ]);

        const response = result.response.text();
        console.log('Received response from Gemini API for image:', response);
        res.json({ response });
    } catch (error) {
        console.error('Lỗi route /describe-image:', error);
        if (error.status === 429) {
            res.status(429).json({ error: 'quá số lượt sử dụng thử lại sau' });
        } else {
            res.status(500).json({ error: 'Đã có lỗi xảy ra.' });
        }
    }
});

// router.post('/clear-history', (req, res) => {
//     conversationHistory = [];
//     res.json({ message: 'Lịch sử trò chuyện đã được xóa.' });
// });

module.exports = router;