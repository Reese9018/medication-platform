---
title: zhiyouyao
emoji: 💊
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# 智药护航 · AI 智能用药管理平台

面向老年人的智能用药管理系统。React 前端 + FastAPI 后端 + PostgreSQL，**前后端同源一体部署**（FastAPI 直接托管前端构建产物，单网址访问，无 CORS 问题）。

## 在线访问

部署后的网址（Hugging Face Space）：

```
https://<你的HF用户名>-zhiyouyao.hf.space
```

演示账号：
- 老人端：`elder / 123456`
- 家属端：`family / 123456`

## 本地开发

### 后端
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # 填 DATABASE_URL、JWT_SECRET_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端
```bash
npm install
npm run dev                # 默认 http://localhost:5173
```

环境变量 `VITE_API_URL` 可选；未设置时：生产构建走同源 `/api/v1`，本地开发指向 `http://localhost:8000/api/v1`。

## 生产部署（Hugging Face Spaces，永久免费）

1. 注册 https://huggingface.co （免费，无需信用卡）
2. 创建 Space：SDK 选 **Docker** → Blank 模板
3. 本地推送：
   ```bash
   git remote add space https://huggingface.co/spaces/<你的HF用户名>/zhiyouyao
   git push space main
   ```
   （首次需要 HF Access Token 作为密码，见 Settings → Access Tokens）
4. Space 的 **Settings → Variables and secrets** 添加：
   | 变量 | 值 |
   |---|---|
   | `DATABASE_URL` | Neon pooled 连接串（`postgresql://...pooler...`） |
   | `JWT_SECRET_KEY` | 任意长随机字符串 |
   | `CORS_ORIGINS` | 留空即可（同源部署无需跨域） |
5. 等待构建（首次约 5-10 分钟），访问 Space 网址即可

> 免费 Space 闲置约 48 小时会休眠，访问网址会自动唤醒（约 1 分钟）；比赛演示前先点开一次即可。

## 改代码后更新线上

```bash
git add .
git commit -m "描述改动"
git push          # 推 GitHub（备份）
git push space main   # 推 HF Space（自动重新构建部署）
```
