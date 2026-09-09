# 智药护航 - 一体化部署镜像（前端 + 后端同源）
# 用于 Hugging Face Spaces / 任何 Docker 平台
# HF Space 会自动注入 PORT=7860

# ---- 阶段 1：构建前端 ----
FROM node:20-slim AS frontend-build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---- 阶段 2：Python 运行时 ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/run.py ./run.py

# 前端构建产物 → FastAPI 同源托管
COPY --from=frontend-build /web/dist ./dist

EXPOSE 7860

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
