require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const port = 8080; // Đổi port thành 8080 ở đây

// Phục vụ các file tĩnh trong thư mục
app.use(express.static(path.join(__dirname)));

// Route trang chủ trỏ về file BossTier.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'BossTier.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
});