import express from 'express';
const router = express.Router({});
// 创建并返回一个新的 Router 对象。这个对象可以被用来定义一组相关的路由。

// 该路由处理器用于响应对根路径(/)的GET请求。
router.get('/', async (_req, res, _next) => {
    // _req（请求对象）、res（响应对象）和_next（下一个中间件函数）是Express路由处理函数的参数。下划线前缀通常表示参数未被使用。
        try {
        // 发送状态码200（OK），表示请求成功。
        res.sendStatus(200);
        } catch (e) {
        // 出错则返回发送失败503
        res.status(503).send();
    }
});

export default router;