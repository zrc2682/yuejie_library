const mysql = require('mysql2');

// 创建连接池（推荐使用连接池而不是单个连接）
const pool = mysql.createPool({
    host: 'localhost', // 数据库主机地址
    user: 'root', // 数据库用户名
    password: 'woaizhb99', // 数据库密码
    database: 'yuejie_library', // 数据库名
    waitForConnections: true,
    connectionLimit: 10, // 最大连接数
    queueLimit: 0,
});

// 将连接池包装为 Promise 形式，以便使用 async/await
const promisePool = pool.promise();

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await promisePool.getConnection();
        console.log('✅ MySQL 数据库连接成功');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL 数据库连接失败:', error.message);
        return false;
    }
}

module.exports = {
    pool,
    promisePool,
    testConnection
};