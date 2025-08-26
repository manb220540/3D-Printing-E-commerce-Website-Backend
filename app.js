require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const path = require('path'); // Import path để xử lý đường dẫn
const cors = require('cors'); // Import cors

const userRoutes = require('./src/routes/userRoutes');
const productRoutes = require('./src/routes/productRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const blogRoutes = require('./src/routes/blogRoutes'); // Import blog routes
const notificationRoutes = require('./src/routes/notificationRoutes'); // Import notification routes
const orderRoutes = require('./src/routes/orderRoutes'); // Import order routes



const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json()); // Cho phép Express đọc JSON từ request body
app.use(cors({
    origin: 'http://localhost:3000', // Cổng frontend của bạn thường là 3000
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));// Sử dụng CORS middleware
// Cấu hình để phục vụ file tĩnh từ thư mục public
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/blogs', blogRoutes); // Sử dụng blog routes
app.use('/api/notifications', notificationRoutes); // Sử dụng notification routes
app.use('/api/orders', orderRoutes); // Sử dụng order routes

// Test route
app.get('/', (req, res) => {
  res.send('Print3D Backend API is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});