const mysql = require('mysql2/promise');

async function initializeDatabase() {
    try {
        // 第一次连接用于创建数据库
        const adminConnection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'woaizhb99' // 请替换为你的密码
        });

        await adminConnection.execute(`CREATE DATABASE IF NOT EXISTS yuejie_library`);
        console.log('✅ 数据库创建成功');
        await adminConnection.end();

        // 第二次连接直接连接到目标数据库
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'woaizhb99',
            database: 'yuejie_library'
        });

        // 创建books表
        await connection.execute(`CREATE TABLE IF NOT EXISTS books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(255) NOT NULL,
            isbn VARCHAR(20),
            cover_image VARCHAR(500), -- 存储图片路径
            categories JSON, -- 存储分类数组
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('✅ 图书表创建成功');

        // 创建users表
        await connection.execute(`CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role ENUM('user', 'admin') DEFAULT 'user', -- 添加角色字段
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('✅ 用户表创建成功');

        // 创建feedback表
        await connection.execute(`CREATE TABLE IF NOT EXISTS feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL,
            issue_type VARCHAR(50) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            status ENUM('new', 'in_progress', 'resolved') DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        console.log('✅ 反馈表创建成功');


        // 插入图书数据
        /* const booksData = [{
                 title: "百年孤独",
                 author: "加西亚·马尔克斯",
                 isbn: "9787544253994",
                 cover_image: "/photo/百年孤独.jpg",
                 categories: JSON.stringify(["文学小说", "中文图书", "获奖作品"])
             },

         ];

         // 插入新数据
         for (const book of booksData) {
             await connection.execute(
                 `INSERT INTO books (title, author, isbn, cover_image, categories) 
                  VALUES (?, ?, ?, ?, ?)`, [book.title, book.author, book.isbn, book.cover_image, book.categories]
             );
         }*/

        await connection.end();
        console.log('✅ 数据库初始化成功');
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
    }
}

// 执行初始化函数
initializeDatabase();