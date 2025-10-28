const express = require('express');
const path = require('path');
const db = require('./db');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');


const app = express();
const PORT = 3000;

// 中间件
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: 'yuejie_library_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        httpOnly: true,
        secure: false
    }
}));
app.use(express.urlencoded({ extended: true }));

// 提供静态文件服务（关键步骤！）
app.use(express.static(path.join(__dirname, 'public')));
// 提供图书封面图片的静态文件服务
app.use('/photo', express.static(path.join(__dirname, 'photo')));

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({
            success: false,
            message: '请先登录'
        });
    }
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: '需要管理员权限'
        });
    }
}

// MD5加密函数
function md5Hash(password) {
    return crypto.createHash('md5').update(password).digest('hex');
}

// 注册API
app.post('/api/register', async(req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: '所有字段都是必填的'
        });
    }

    try {
        // 检查用户是否已存在
        const [userExists] = await db.promisePool.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]
        );

        if (userExists.length > 0) {
            return res.status(409).json({
                success: false,
                message: '用户名或邮箱已存在'
            });
        }

        // 对密码进行MD5加密
        const hashedPassword = md5Hash(password);

        // 创建新用户，默认角色为user
        const [result] = await db.promisePool.execute(
            'INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, "user", NOW())', [username, email, hashedPassword]
        );

        if (result.affectedRows > 0) {
            res.json({
                success: true,
                message: '注册成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '注册失败，请稍后重试'
            });
        }
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
});

// 登录API - 使用MD5加密验证
app.post('/api/login', async(req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: '用户名和密码是必填的'
        });
    }

    try {
        // 查询用户信息，包括角色字段
        const [users] = await db.promisePool.execute(
            'SELECT id, username, email, password, role FROM users WHERE username = ?', [username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }

        const user = users[0];
        const hashedInputPassword = md5Hash(password);

        if (hashedInputPassword === user.password) {
            // 基于数据库中的role字段设置Session
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role, // 从数据库读取角色
            };
            req.session.isLogin = true;

            res.json({
                success: true,
                message: '登录成功',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                }
            });
        } else {
            res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
});

// 反馈API端点
app.post('/api/feedback', async(req, res) => {
    const { name, email, issueType, subject, description } = req.body;

    // 验证输入
    if (!name || !email || !issueType || !subject || !description) {
        return res.status(400).json({
            success: false,
            message: '所有字段都是必填的'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: '邮箱格式不正确'
        });
    }

    try {
        const [result] = await db.promisePool.execute(
            'INSERT INTO feedback (name, email, issue_type, subject, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, "new", NOW(), NOW())', [name, email, issueType, subject, description]
        );

        if (result.affectedRows > 0) {
            console.log(`新的反馈提交: ${subject} - ${name} (${email})`);
            res.json({
                success: true,
                message: '反馈提交成功',
                feedbackId: result.insertId
            });
        } else {
            res.status(500).json({
                success: false,
                message: '提交失败，请稍后重试'
            });
        }
    } catch (error) {
        console.error('反馈提交错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
});

// 获取反馈列表API
app.get('/api/feedback', async(req, res) => {
    try {
        const [feedbacks] = await db.promisePool.execute(
            'SELECT id, name, email, issue_type, subject, description, status, created_at, updated_at FROM feedback ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            data: feedbacks
        });
    } catch (error) {
        console.error('获取反馈列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取反馈列表失败'
        });
    }
});

// 获取所有图书API
app.get('/api/books', async(req, res) => {
    try {
        const [books] = await db.promisePool.execute(
            'SELECT id, title, author, cover_image, categories FROM books ORDER BY created_at DESC'
        );

        res.json(books);
    } catch (error) {
        console.error('获取图书列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取图书列表失败'
        });
    }
});

// 按分类获取图书API
app.get('/api/books/category/:category', async(req, res) => {
    const { category } = req.params;

    try {
        const [books] = await db.promisePool.execute(
            'SELECT id, title, author, cover_image, categories FROM books WHERE categories LIKE ? ORDER BY created_at DESC', [`%${category}%`]
        );

        res.json(books);
    } catch (error) {
        console.error('按分类获取图书错误:', error);
        res.status(500).json({
            success: false,
            message: '获取分类图书失败'
        });
    }
});


// 添加用户角色管理API（管理员专用）
app.put('/api/admin/users/:id/role', requireAdmin, async(req, res) => {
    const userId = req.params.id;
    const { role } = req.body;

    // 验证角色值
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({
            success: false,
            message: '角色值无效'
        });
    }

    try {
        await db.promisePool.execute(
            'UPDATE users SET role = ? WHERE id = ?', [role, userId]
        );

        res.json({
            success: true,
            message: '用户角色更新成功'
        });
    } catch (error) {
        console.error('更新用户角色失败:', error);
        res.status(500).json({
            success: false,
            message: '更新用户角色失败'
        });
    }
});

// 添加获取用户列表API（管理员专用）
app.get('/api/admin/users', requireAdmin, async(req, res) => {
    try {
        const [users] = await db.promisePool.execute(
            'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户列表失败'
        });
    }
});

// 添加管理员统计API
app.get('/api/admin/stats', requireAdmin, async(req, res) => {
    try {
        const [userCount] = await db.promisePool.execute('SELECT COUNT(*) as count FROM users');
        const [bookCount] = await db.promisePool.execute('SELECT COUNT(*) as count FROM books');
        const [feedbackCount] = await db.promisePool.execute('SELECT COUNT(*) as count FROM feedback');
        const [adminCount] = await db.promisePool.execute('SELECT COUNT(*) as count FROM users WHERE role = "admin"');

        res.json({
            success: true,
            data: {
                totalUsers: userCount[0].count,
                totalBooks: bookCount[0].count,
                totalFeedback: feedbackCount[0].count,
                adminUsers: adminCount[0].count
            }
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计数据失败'
        });
    }
});

// 添加获取当前用户信息API
app.get('/api/whoami', (req, res) => {
    if (req.session && req.session.user) {
        res.json({
            success: true,
            user: req.session.user,
            isLogin: true
        });
    } else {
        res.json({
            success: true,
            user: null,
            isLogin: false
        });
    }
});

// 添加退出登录API
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: '退出登录失败'
            });
        }
        res.clearCookie('connect.sid');
        res.json({
            success: true,
            message: '退出登录成功'
        });
    });
});


// 管理员专用API - 获取所有反馈
app.get('/api/admin/feedback', requireAdmin, async(req, res) => {
    try {
        const [feedbacks] = await db.promisePool.execute(
            'SELECT id, name, email, issue_type, subject, description, status, created_at FROM feedback ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            data: feedbacks
        });
    } catch (error) {
        console.error('获取反馈列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取反馈列表失败'
        });
    }
});

// 管理员专用API - 更新反馈状态
app.put('/api/admin/feedback/:id/status', requireAdmin, async(req, res) => {
    const feedbackId = req.params.id;
    const { status } = req.body;

    try {
        await db.promisePool.execute(
            'UPDATE feedback SET status = ?, updated_at = NOW() WHERE id = ?', [status, feedbackId]
        );

        res.json({
            success: true,
            message: '反馈状态更新成功'
        });
    } catch (error) {
        console.error('更新反馈状态失败:', error);
        res.status(500).json({
            success: false,
            message: '更新反馈状态失败'
        });
    }
});


// 更新用户个人资料API
app.put('/api/user/profile', requireAuth, async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { username, email, } = req.body;

        // 验证输入
        if (!username || !email) {
            return res.status(400).json({
                success: false,
                message: '用户名和邮箱是必填的'
            });
        }

        // 检查邮箱是否已被其他用户使用
        const [emailExists] = await db.promisePool.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]
        );

        if (emailExists.length > 0) {
            return res.status(409).json({
                success: false,
                message: '邮箱已被其他用户使用'
            });
        }

        // 更新用户基本信息
        await db.promisePool.execute(
            'UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, userId]
        );

        // 更新session中的用户信息
        req.session.user.username = username;
        req.session.user.email = email;

        res.json({
            success: true,
            message: '个人资料更新成功'
        });

    } catch (error) {
        console.error('更新用户资料失败:', error);
        res.status(500).json({
            success: false,
            message: '更新用户资料失败'
        });
    }
});

// 获取用户个人主页数据
app.get('/api/user/profile-data', requireAuth, async(req, res) => {
    try {
        const userId = req.session.user.id;

        // 获取用户基本信息
        const [users] = await db.promisePool.execute(
            'SELECT username, email, role, books_read, reading_time, reading_preferences, last_active FROM users WHERE id = ?', [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        const userData = users[0];

        // 获取当前阅读 - 修改为获取多本书籍
        const [currentReading] = await db.promisePool.execute(`
            SELECT b.id, b.title, b.author, b.cover_image, cr.current_page, cr.total_pages, cr.last_read
            FROM current_reading cr
            JOIN books b ON cr.book_id = b.id
            WHERE cr.user_id = ?
            ORDER BY cr.last_read DESC
            LIMIT 5
        `, [userId]);

        // 获取阅读历史
        const [readingHistory] = await db.promisePool.execute(`
            SELECT b.id, b.title, b.author, b.cover_image, rh.status, rh.start_date, rh.end_date
            FROM reading_history rh
            JOIN books b ON rh.book_id = b.id
            WHERE rh.user_id = ?
            ORDER BY rh.start_date DESC
            LIMIT 10
        `, [userId]);

        // 获取我的书架
        const [myBookshelf] = await db.promisePool.execute(`
            SELECT b.id, b.title, b.author, b.cover_image, ub.shelf_type, ub.added_date
            FROM user_bookshelf ub
            JOIN books b ON ub.book_id = b.id
            WHERE ub.user_id = ?
            ORDER BY ub.added_date DESC
            LIMIT 12
        `, [userId]);

        // 计算当前阅读的进度百分比（多本书）
        let currentReadingWithProgress = currentReading.map(book => {
            const progress = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
            return {
                ...book,
                progress: progress
            };
        });

        res.json({
            success: true,
            data: {
                user: {
                    username: userData.username,
                    email: userData.email,
                    role: userData.role || 'user',
                    booksRead: userData.books_read || 0,
                    readingTime: userData.reading_time || 0,
                    readingPreferences: userData.reading_preferences || '暂无偏好',
                    lastActive: userData.last_active
                },
                currentReading: currentReadingWithProgress, // 现在是数组
                readingHistory: readingHistory,
                myBookshelf: myBookshelf
            }
        });

    } catch (error) {
        console.error('获取用户个人主页数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取个人主页数据失败'
        });
    }
});

// 获取阅读排行榜API
app.get('/api/ranking/reading-time', async(req, res) => {
    try {
        const [ranking] = await db.promisePool.execute(`
            SELECT 
                username,
                reading_time,
                books_read,
                last_active
            FROM users 
            WHERE reading_time > 0 
            ORDER BY reading_time DESC 
            LIMIT 50
        `);

        // 添加排名序号
        const rankedList = ranking.map((user, index) => ({
            rank: index + 1,
            username: user.username,
            readingTime: user.reading_time,
            booksRead: user.books_read || 0,
            lastActive: user.last_active
        }));

        res.json({
            success: true,
            data: rankedList
        });
    } catch (error) {
        console.error('获取阅读排行榜失败:', error);
        res.status(500).json({
            success: false,
            message: '获取排行榜失败'
        });
    }
});

// 开始阅读会话
app.post('/api/reading/start', requireAuth, async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { bookId } = req.body;

        // 检查是否已有当前阅读记录
        const [existing] = await db.promisePool.execute(
            'SELECT id FROM current_reading WHERE user_id = ? AND book_id = ?', [userId, bookId]
        );

        if (existing.length > 0) {
            // 更新最后阅读时间
            await db.promisePool.execute(
                'UPDATE current_reading SET last_read = NOW()  WHERE user_id = ? AND book_id = ?', [userId, bookId]
            );

        } else {
            // 创建新的阅读记录
            await db.promisePool.execute(
                `INSERT INTO current_reading (user_id, book_id, start_date, last_read) 
                 VALUES (?, ?, NOW(), NOW())`, [userId, bookId]
            );

        }

        // 添加到阅读历史
        const [historyExists] = await db.promisePool.execute(
            'SELECT id FROM reading_history WHERE user_id = ? AND book_id = ? AND status = "reading"', [userId, bookId]
        );

        if (historyExists.length === 0) {
            //
            await db.promisePool.execute(
                `INSERT INTO reading_history (user_id, book_id, start_date, status)
                VALUES (?, ?, NOW(), "reading")`, [userId, bookId]
            );
        }

        res.json({
            success: true,
            message: '阅读会话开始'
        });

    } catch (error) {
        console.error('开始阅读会话失败:', error);
        res.status(500).json({
            success: false,
            message: '开始阅读失败'
        });
    }

});

// 更新阅读进度
app.post('/api/reading/progress', requireAuth, async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { bookId, currentPage, totalPages, readingTime } = req.body;

        const progressPercent = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

        // 更新当前阅读进度
        await db.promisePool.execute(
            `UPDATE current_reading 
             SET current_page = ?, total_pages = ?, reading_session_time = reading_session_time + ?,
                 progress_percent = ?, last_read = NOW() 
             WHERE user_id = ? AND book_id = ?`, [currentPage, totalPages, readingTime || 0, progressPercent, userId, bookId]
        );

        // 更新阅读历史
        await db.promisePool.execute(
            `UPDATE reading_history 
             SET reading_time = reading_time + ?, updated_at = NOW() 
             WHERE user_id = ? AND book_id = ? AND status = "reading"`, [readingTime || 0, userId, bookId]
        );

        // 更新用户总阅读时间
        await db.promisePool.execute(
            'UPDATE users SET reading_time = reading_time + ?, last_active = NOW() WHERE id = ?', [readingTime || 0, userId]
        );

        res.json({
            success: true,
            message: '阅读进度更新成功'
        });


    } catch (error) {
        console.error('更新阅读进度失败:', error);
        res.status(500).json({
            success: false,
            message: '更新进度失败'
        })
    }
});

// 完成阅读
app.post('/api/reading/complete', requireAuth, async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { bookId } = req.body;

        // 更新阅读历史状态
        await db.promisePool.execute(
            `UPDATE reading_history 
             SET status = "completed", end_date = NOW(), updated_at = NOW() 
             WHERE user_id = ? AND book_id = ?`, [userId, bookId]
        );

        // 移除当前阅读
        await db.promisePool.execute(
            'DELETE FROM current_reading WHERE user_id = ? AND book_id = ?', [userId, bookId]
        );

        // 更新用户已读书籍数量
        await db.promisePool.execute(
            'UPDATE users SET books_read = books_read + 1 WHERE id = ?', [userId]
        );

        // 添加到书架
        const [shelfExists] = await db.promisePool.execute(
            'SELECT id FROM user_bookshelf WHERE user_id = ? AND book_id = ?', [userId, bookId]
        );

        if (shelfExists.length === 0) {
            await db.promisePool.execute(
                `INSERT INTO user_bookshelf (user_id, book_id, shelf_type, added_date) 
                 VALUES (?, ?, "read", NOW())`, [userId, bookId]
            );
        }


        res.json({
            success: true,
            message: '阅读完成'
        });

    } catch (error) {
        console.error('完成阅读失败:', error);
        res.status(500).json({
            success: false,
            message: '完成阅读失败'
        });
    }

});

//暂停阅读
app.post('/api/reading/pause', requireAuth, async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { bookId } = req.body;

        await db.promisePool.execute(
            `UPDATE reading_history 
             SET status = "paused", updated_at = NOW() 
             WHERE user_id = ? AND book_id = ? AND status = "reading"`, [userId, bookId]
        );


        res.json({
            success: true,
            message: '阅读已暂停'
        });

    } catch (error) {
        console.error('暂停阅读失败:', error);
        res.status(500).json({
            success: false,
            message: '暂停阅读失败'
        });
    }

});

//删除功能
app.post('/api/user/remove', requireAuth, async(req, res) => {
    try {
        const userId = req.session.user.id;
        const { type, bookId } = req.body;

        let tableName, message;

        switch (type) {
            case 'current':
                tableName = 'current_reading';
                message = '已从当前阅读中删除';
                break;
            case 'history':
                tableName = 'reading_history';
                message = '已从阅读历史中删除';
                break;
            case 'bookshelf':
                tableName = 'user_bookshelf'
                message = '已从我的书架中删除';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: '无效删除类型'
                })
        }

        const [result] = await db.promisePool.execute(
            `DELETE FROM ${tableName} WHERE user_id = ? AND book_id = ?`, [userId, bookId]
        );

        if (result.affectedRows > 0) {
            res.json({
                success: true,
                message: message
            })
        } else {
            res.status(404).json({
                success: false,
                message: '未找到对应的记录'
            });
        }

    } catch (error) {
        console.error('删除失败:', error);
        res.status(500).json({
            success: false,
            message: '删除失败，请稍后重试'
        });
    }

});

// 启动服务器前测试数据库连接
async function startServer() {
    try {
        // 测试数据库连接
        const isConnected = await db.testConnection();
        if (!isConnected) {
            console.error('❌ 无法连接到数据库，服务器启动失败');
            process.exit(1); // 退出进程
        }

        console.log('✅ 数据库连接成功');

        // 启动服务器
        app.listen(PORT, () => {
            console.log(`阅界图书馆服务器运行在 http://localhost:${PORT}`);
            console.log(`API端点: http://localhost:${PORT}/api/`);
            console.log(`前端页面: http://localhost:${PORT}/`);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();