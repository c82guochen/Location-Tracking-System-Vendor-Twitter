import express from 'express';
const router = express.Router({});
// 定义一个路由处理器，用于响应对根路径(/)的GET请求。
router.get('/', async (_req, res, _next) => {
    // _req（请求对象）、res（响应对象）和_next（下一个中间件函数）是Express路由处理函数的参数。下划线前缀通常表示参数未被使用。
    try {
    // 发送状态码200（OK），表示请求成功。
    res.sendStatus(200);
  } catch (e) {
    res.status(503).send();
  }
});
// 将这个路由导出，以便它可以在其他地方被导入和使用。
export default router;