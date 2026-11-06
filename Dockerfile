# ---- 前端构建 ----
# 产物是与架构无关的静态文件，固定在构建机的原生平台上运行，多架构构建时不必经过 QEMU 模拟
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 运行时 ----
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.9 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR /app
# 先只装依赖，利用镜像层缓存
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
RUN uv sync --frozen --no-dev

COPY --from=frontend /app/dist /app/static

# 以 uid 1000 运行；宿主机上的 ./data 需要对该用户可写
RUN useradd --uid 1000 --create-home closetly && mkdir -p /data && chown closetly:closetly /data
USER closetly

ENV CLOSETLY_DATA_DIR=/data \
    CLOSETLY_STATIC_DIR=/app/static

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

# --proxy-headers：信任反向代理传来的 X-Forwarded-For / -Proto，
# 信任范围由环境变量 FORWARDED_ALLOW_IPS 控制
CMD ["uvicorn", "closetly.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
