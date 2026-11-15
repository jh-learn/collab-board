# redis异步客户端
import redis.asyncio as redis
from app.config import settings

# 模块级全局变量，存放 Redis 连接池。
_pool: redis.ConnectionPool | None = None

def get_pool() -> redis.ConnectionPool:
    """获取连接池的函数"""
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(settings.redis_url,decode_responses=True)
    return _pool

def get_redis() -> redis.Redis:
    """获取 Redis 客户端的函数"""
    return redis.Redis(connection_pool=get_pool())

def state_key(room_id:str) -> str:
    """生成房间状态的 Redis key """
    return f"room:{room_id}:state"

def stream_key(room_id:str) -> str:
    """生成房间事件流的key 记录操作历史"""
    return f"room:{room_id}:stream"

def pubsub_channel(room_id:str) -> str:
    """生成房间 Pub/Sub 频道名 实时广播"""
    return f"room:{room_id}:pubsub"

async def ensure_state(room_id:str) ->None:
    """异步函数 确保房间状态key存在""" 
    r = get_redis()
    if not await r.exists(state_key(room_id)):
        await r.json().set(state_key(room_id),"$",{"shapes":{},"comments":{}})

async def json_get_state(room_id:str) -> dict:
    """异步读取整个房间状态"""
    r = get_redis()
    data = await r.json().get(state_key(room_id))
    return data or {"shapes": {}, "comments": {}}

async def json_set_element(room_id:str,element_type:str,element:dict) -> None:
    """把一个元素写入房间状态"""
    r = get_redis()
    await r.json().set(state_key(room_id),f"$.{element_type}s.{element['id']}",element)

async def json_get_element(room_id:str,element_type:str,element_id:str) -> dict | None:
    """读取单个元素"""
    r = get_redis()
    res = await r.json().get(state_key(room_id),f"$.{element_type}s.{element_id}")
    if isinstance(res,list) and res:
        return res[0]
    if isinstance(res,dict):
        return res
    return None

async def json_delete_element(room_id:str,element_type:str,element_id:str) -> None:
    """删除单个元素"""
    r = get_redis()
    await r.json().delete(state_key(room_id),f"$.{element_type}s.{element_id}")