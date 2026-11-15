import asyncio
import json
import logging
from typing import Set

from fastapi import WebSocket

from app.redis_client import get_redis,pubsub_channel,stream_key,json_get_state

logger = logging.getLogger("room_manager")

class RoomConnectionManager:
    """管理每个房间的 WebSocket 连接，并把 Redis Pub/Sub 消息分发给房间内所有客户端。"""
    
    def __init__(self) -> None:
        # room_id -> 该房间当前所有活跃 WebSocket 连接的集合
        self.connections:dict[str,Set[WebSocket]] = {}
         # room_id -> 该房间后台 Pub/Sub 订阅任务（每个房间只创建一个）
        self._pubsub_tasks:dict[str,asyncio.Task] = {}

    async def connect(self,room_id:str,ws:WebSocket,user:str) -> None:
        """新客户端加入房间：接受连接、发送当前快照、必要时回放历史、确保订阅任务已启动。"""
        # 完成 WebSocket 握手
        await ws.accept()
        # 把连接注册到对应房间的集合中（房间不存在则自动创建集合）
        self.connections.setdefault(room_id,set()).add(ws)

        # 从 Redis 读取房间当前完整状态（shapes + comments）
        state = await json_get_state(room_id)
        # 先发快照，客户端据此初始化画布；"you" 告诉客户端自己是谁
        await ws.send_json({"type":"snapshot","payload":{**state,"you":user}})

        # 仅当状态为空时才回放 Stream 历史（避免与快照重复）
        if not state["shapes"] and not state["comments"]:
            await self._replay_stream(room_id,ws)

         # 该房间还没有后台订阅任务时，才创建；否则复用已有任务
        if room_id not in self._pubsub_tasks:
            self._pubsub_tasks[room_id] = asyncio.create_task(self._subcribe_room(room_id))
    async def _replay_stream(self,room_id:str,ws:WebSocket) -> None:
        """从 Stream 读取历史操作并逐条发给刚加入的客户端，用于重建空状态。"""
        r = get_redis()
        try:
            # 读该房间 Stream 的前 500 条（不指定起止 ID 时从头读）
            entries = await r.xrange(stream_key(room_id),count=500)
        except Exception as e:
            # 回放失败只记日志，不中断连接流程
            logger.warning("replay failed: %s",e)
            return
        for _,fields in entries:
            # Stream 里 payload 字段是 JSON 字符串，反序列化后以 op 消息发送
            payload = json.loads(fields["payload"])
            await ws.send_json({"type":"op","payload":payload})

    async def disconnect(self,room_id:str,ws:WebSocket) -> None:
        """客户端断开：从房间移除连接；若房间已空，则取消订阅任务并清理房间条目。"""
        conns = self.connections.get(room_id)
        if conns:
            # 从房间集合里移除该连接。discard 不会在元素不存在时抛 KeyError
            conns.discard(ws)
            # 如果移除后房间已无任何连接
            if not conns:
                # 取消后台订阅任务，避免空跑 
                task = self._pubsub_tasks.pop(room_id,None)
                if task:
                    task.cancel()
                # 清理房间连接表，防止内存泄漏
                self.connections.pop(room_id,None)

    async def _subcribe_room(self,room_id:str) -> None:
        """后台任务：订阅房间频道，把收到的消息广播给房间内所有连接。"""
        r = get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe(pubsub_channel(room_id))
        try:
            # listen() 是异步迭代器，持续产出订阅消息
            async for message in pubsub.listen():
                # 过滤掉 subscribe/unsubscribe 等控制消息，只处理业务消息
                if message["type"] != "message":
                    continue
                data = json.loads(message["data"])
                # 转成 list 再遍历，避免遍历过程中 disconnect 修改 set 导致 RuntimeErro
                conns = list(self.connections.get(room_id,set()))
                dead:list[WebSocket] = []
                for ws in conns:
                    try:
                        await ws.send_json(data)
                    except Exception:
                        # 发送失败的连接先收集，循环结束后统一清理
                        dead.append(ws)
                for ws in dead:
                    await self.disconnect(room_id,ws)
        except asyncio.CancelledError:
            # 被 disconnect 取消时，先退订
            await pubsub.unsubscribe()
        finally:
            # 无论正常退出还是异常，都关闭 pubsub 连接释放资源
            await pubsub.close()

# 全局单例，供路由和 WebSocket 端点导入使用
manager = RoomConnectionManager()