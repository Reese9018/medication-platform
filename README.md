# 智药护航 · AI 智能用药管理平台

面向老年人的智能用药管理系统。React 前端 + FastAPI 后端 + PostgreSQL。

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

环境变量 `VITE_API_URL` 可选，默认 `http://localhost:8000/api/v1`。

### 演示账号
- 老人端：`elder / 123456`
- 家属端：`family / 123456`

## 生产部署

详细分步说明见 [DEPLOY.md](./DEPLOY.md)。

技术栈：**Vercel**（前端静态托管）+ **Render**（后端 Docker）+ **Neon**（PostgreSQL 永久免费层）。三者均通过 GitHub 集成，push 即触发自动部署。