# 智药护航后端

独立的 FastAPI + SQLAlchemy + MySQL 后端，不修改前端代码。

## 启动

1. 创建 MySQL 数据库：`zhiyouyao`
2. 复制 `.env.example` 为 `.env`，填写 `DATABASE_URL` 和 `JWT_SECRET_KEY`
3. 安装依赖：`pip install -r requirements.txt`
4. 启动：`uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
5. 接口文档：`http://localhost:8000/docs`

应用启动时会创建表，并写入 `elder/123456` 与 `family/123456` 两个演示账号及一套初始数据。生产环境应使用 Alembic 管理迁移，并替换演示密码。

## 接口范围

- `/api/v1/auth`：登录、注册、当前用户
- `/api/v1/users`：健康档案
- `/api/v1/medications`：药品增删改查与模拟 OCR
- `/api/v1/schedule`：今日用药计划、服药状态
- `/api/v1/health-records`：健康数据录入、查询
- `/api/v1/risks`：风险列表与深度分析
- `/api/v1/assistant`：结构化模拟 AI 问答
- `/api/v1/family`：家属绑定与监护信息
- `/api/v1/reports`：周报/月报生成与查询
- `/api/v1/notifications`：消息提醒

所有业务接口默认要求 `Authorization: Bearer <token>`。CORS 默认允许 `http://localhost:5173`。
