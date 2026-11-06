# Closetly

自用的电子衣柜：记录自己有哪些衣服，保存搭配，根据天气推荐今天穿什么。

需求与开发计划见 [REQUIREMENTS.md](REQUIREMENTS.md)。

## 部署

需要 Docker 和一个已经配置好 HTTPS 的反向代理。

```bash
cp .env.example .env      # 修改管理员账号和密码
mkdir -p data             # 先手动创建，避免 Docker 以 root 身份创建导致容器（uid 1000）无法写入
docker compose up -d --build
```

应用默认监听 `127.0.0.1:8000`，把反向代理指向这个地址即可。代理需要传递 `X-Forwarded-For` 和 `X-Forwarded-Proto`。以 Caddy 为例：

```
closet.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

照片上传前会在浏览器里压缩，但单个请求仍可能超过 1MB。**Nginx 默认的请求体上限只有 1MB**，请调大：

```nginx
client_max_body_size 20m;
```

如果反向代理也运行在 Docker 中，可以去掉 `docker-compose.yml` 里的 `ports`，改为把容器加入代理所在的网络。

注意：

- 首次启动时会根据 `.env` 创建管理员账号。之后修改 `.env` 里的密码**不会**生效，请在网页的「设置」中修改。
- 浏览器定位（今日推荐）只能在 HTTPS 下使用。天气由浏览器直接请求 `api.open-meteo.com`，服务器不需要访问外网；如果浏览器访问不到它，可以在页面上手动选择气温档位。
- 所有数据都在 `./data` 中（SQLite 数据库和图片），备份时复制这个目录即可。

升级：

```bash
git pull && docker compose up -d --build   # 启动时自动执行数据库迁移
```

## 本地开发

后端（Python 3.12，使用 [uv](https://docs.astral.sh/uv/)）：

```bash
cd backend
uv sync
CLOSETLY_COOKIE_SECURE=false \
CLOSETLY_ADMIN_USERNAME=admin CLOSETLY_ADMIN_PASSWORD=admin1234 \
  uv run uvicorn closetly.main:create_app --factory --reload
uv run pytest                                        # 测试
uv run alembic revision --autogenerate -m "说明"      # 修改模型后生成迁移
```

前端（Node 22，React + Vite + TypeScript）：

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173，/api 请求会转发到 127.0.0.1:8000
npm run lint    # oxlint
```

API 文档：后端启动后访问 `/api/docs`。

## 项目结构

```
backend/
  src/closetly/
    main.py          应用入口（create_app），托管前端静态文件
    config.py        配置（CLOSETLY_* 环境变量）
    models.py        数据模型
    bootstrap.py     启动时执行迁移、创建管理员、清理图片
    security.py      密码哈希与会话 token
    ratelimit.py     登录限流
    routers/         API 路由
    migrations/      Alembic 迁移
  tests/
frontend/
  src/
    api.ts           请求封装
    auth.ts          登录状态（TanStack Query）
    queryClient.ts   接口数据缓存配置
    router.tsx       路由表（按页面懒加载）
    components/      布局、路由守卫等通用组件
    views/           页面（每个页面配一个 .module.css）
```
