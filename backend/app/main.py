import json
import asyncio
import logging
from contextlib import asynccontextmanager

import secrets
# 密码学安全的随机数（生成房间 ID/邀请码）
import psycopg
# PostgreSQL 驱动，支持 AsyncConnection

from fastapi import HTTPException,Query,WebSocket
from fastapi.middleware.cors import CORSMiddleware

from fastapi_offline import FastAPIOffline

from app.auth import create_token, verify_token
from app.config import settings
from app.handlers import process_op
from app.models import CreateRoomRequest, JoinRoomRequest
from app.redis_client import get_redis, pubsub_channel, ensure_state, json_get_state
from app.room_manager import manager
from app.snapshot import snapshot_worker, read_latest_snapshot

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPIOffline):
    task = asyncio.create_task(snapshot_worker(lambda: list(manager.connections.keys())))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPIOffline(title="Collab Board",lifespan=lifespan)
# 跨域
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])

async def _persist_room(room_id: str,invite_code: str) -> None:
    """持久化辅助函数 把房间写入数据库。"""
    
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        
        """异步链接"""
        async with conn.cursor() as cur:
            
            await cur.execute(
                "INSERT INTO rooms (room_id, invite_code) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (room_id,invite_code)
            )
            await conn.commit()

async def _find_room_by_code(code: str) -> str | None:
    """用邀请码反查房间ID"""
    
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT room_id FROM rooms WHERE in vite_code=%s",(code,))
            # 取结果集的下一行（第一行），没有则返回 None"：查到 1 行	一个元组，如 ('abc123',)
            row = await cur.fetchone()
            return row[0] if row else None

@app.post("/api/v1/rooms")
async def create_room(req: CreateRoomRequest):
    """创建房间"""

    # 生成约 11 个字符的 URL 安全随机串（8 字节 → base64url ≈ 11 字符）
    room_id = secrets.token_urlsafe(8)
    invite_code = secrets.token_urlsafe(6)

    await ensure_state(room_id)
    await _persist_room(room_id,invite_code)

    token = create_token(room_id,req.name or "creator")

    return {"room_id": room_id,"invite_code": invite_code,"token": token}

@app.post("/api/v1/rooms/join")
async def join_room(req: JoinRoomRequest):
    """加入房间"""
    room_id = req.room_id
    if not room_id and req.invite_code:
        room_id = await _find_room_by_code(req.invite_code)
    if not room_id:
        raise HTTPException(status_code=400,detail="room_id or invite_code require")
    token = create_token(room_id,req.name or "anon")
    return {"room_id":room_id,"token":token}

@app.get("/api/v1/health")
async def health():
    return {"ok": True}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(ws:WebSocket,room_id:str,token:str = Query(...)):
    """ 
    WebSocket端点 握手阶段鉴权
    
    参数：
        ...
        token:从 URL 查询参数取 token
    """
    payload = verify_token(token)

    if not payload or payload.get("room_id") != room_id:
        await ws.accept() 
        await ws.close(code=1008)
        return

    # 从 JWT 取用户名（sub），缺省 anon。
    # 调用 manager.connect，内部会 accept()、注册连接、发快照、必要时回放、启动订阅任务。
    user = payload.get("sub","anon")
    await manager.connect(room_id,ws,user)

    try:
        while True:
            # # 主循环阻塞等待客户端发文本消息，解析 JSON，取 type 字段分派。
                # receive_text 在连接关闭时抛异常，跳出循环。
            raw = await ws.receive_text()
            msg = json.loads(raw)
            mtype = msg.get("type")

            # 操作消息：交给 process_op 做 LWW 校验、写 Redis、写 Stream、Pub/Sub 广播。
            # 被接受时不回消息——客户端会通过 Pub/Sub 广播收到自己的操作（包括其他客户端的操作），这是合理的“广播即确认”。
            if mtype == "op":
                accepted,err = await process_op(room_id,msg["payload"])
                if not accepted:
                    await ws.send_json({"type":"error","payload":{"reason":err}})

            # 光标位置广播：不写 Stream、不校验版本，直接 Pub/Sub 转发，并注入 sender 字段让其他客户端知道是谁的光标。
            # 光标是高频、瞬态数据，不需要持久化。
            elif mtype == "cursor":
                r = get_redis()
                await r.publish(
                    pubsub_channel(room_id),
                    json.dumps({"type":"cursor",
                                "payload":{**msg["payload"],"sender":user}},
                                ensure_ascii=False)
                )
            # 心跳：收到 ping 回 pong，用于客户端检测连接存活。
            elif mtype == "ping":
                await ws.send_json({"type":"pong","payload":{}})
            # 未知类型回 error。
            else:
                await ws.send_json({"type":"error","payload":{"reason":"unknow_type"}})
    except Exception:
        pass
    # 保证无论怎样都从 manager 注销连接。
    finally:
        await manager.disconnect(room_id,ws)

@app.get("/api/v1/rooms/{room_id}/history")
async def get_history(room_id: str, count: int = 500):
    """直接 xrange 读 Stream 前 count 条。硬编码了 key 字符串 f"room:{room_id}:stream"""
    r = get_redis()
    entries = await r.xrange(f"room:{room_id}:stream", count=count)
    # 把每条 Stream 条目转成 {"id": Stream条目ID, "payload": 反序列化后的操作}。返回 Stream ID 是有用的，客户端可以用它做增量游标。
    return [{"id": eid, "payload": json.loads(f["payload"])} for eid, f in entries]

@app.post("/api/v1/_debug/op/{room_id}")
async def debug_op(room_id: str, payload: dict):
    return {"result": await process_op(room_id, payload)}

@app.get("/api/v1/rooms/{room_id}/snapshot")
async def get_snapshot(room_id: str):
    """获取快照"""
    state = await read_latest_snapshot(room_id)
    if state is None:
        state = await json_get_state(room_id)
    return state