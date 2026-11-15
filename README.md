# Collab Board

实时协同白板与代码评审工作台。用户可创建或加入房间，在白板中协作绘图，并在 Monaco 编辑器中添加代码行评论。

## 技术栈

- 前端：React 18、TypeScript 5、Vite、react-konva/Konva、Monaco Editor
- 后端：Python 3.14、FastAPI、FastAPI Offline、Pydantic、uv
- 实时通信：WebSocket、Redis Pub/Sub
- 状态与历史：Redis Stack（RedisJSON、Streams）
- 持久化：PostgreSQL 16、psycopg 3 异步驱动
- 鉴权：JWT（python-jose + cryptography）
- 部署：Docker Compose、前后端独立 Dockerfile

## 快速启动

### Docker Compose

```bash
docker compose up --build
```

访问：

- 前端：http://localhost:5173
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/v1/health

### 本地开发

先启动 Redis 和 PostgreSQL，再分别启动前后端：

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

环境变量示例见 [.env.example](./.env.example)。后端主要配置包括 `REDIS_URL`、`DATABASE_URL`、`JWT_SECRET`、`SNAPSHOT_INTERVAL` 和 `STREAM_MAXLEN`。

## 核心流程

1. `POST /api/v1/rooms` 创建房间，写入 PostgreSQL 并返回房间 ID、邀请码和 JWT。
2. `POST /api/v1/rooms/join` 使用房间 ID 或邀请码加入房间。
3. 前端通过 `/ws/{room_id}?token=...` 建立 WebSocket 连接。
4. 连接建立后服务端发送快照；客户端发送白板、评论和光标操作。
5. 操作经版本校验后写入 RedisJSON，并追加到 Redis Stream，再通过 Pub/Sub 广播给同房间客户端。
6. 后台快照任务定期把活跃房间状态写入 PostgreSQL；Redis 作为实时状态源，PostgreSQL 保存房间元数据和快照。

## 一致性模型

图形和评论使用元素级 Last-Write-Wins（LWW）版本控制：服务端拒绝版本号小于或等于当前值的操作，并返回 `stale_version`。删除操作在客户端保留元素并标记 `deleted`，用于避免本地状态丢失版本信息。

更多实现说明见 [技术栈与知识总结.txt](./技术栈与知识总结.txt)。
