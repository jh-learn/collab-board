import asyncio
import json
import logging
import psycopg
from app.config import settings
from app.redis_client import json_get_state

logger = logging.getLogger("snapshot")

async def dump_snapshot(room_id: str) -> None:
    """写快照到数据库"""
    # 从 Redis 读当前房间状态
    state = await json_get_state(room_id)
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO room_snapshots (room_id, state) VALUES (%s, %s)",
                (room_id, json.dumps(state)),
            )
            await conn.commit()


async def snapshot_worker(get_active_rooms) -> None:
    """后台循环任务"""
    while True:
        await asyncio.sleep(settings.snapshot_interval)
        try:
            room_ids = get_active_rooms()
        except Exception:
            room_ids = []
        for rid in room_ids:
            try:
                await dump_snapshot(rid)
            except Exception as e:
                logger.warning("snapshot failed for %s: %s", rid, e)


async def read_latest_snapshot(room_id: str) -> dict | None:
    """读最新快照"""
    async with await psycopg.AsyncConnection.connect(settings.database_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT state FROM room_snapshots WHERE room_id=%s ORDER BY created_at DESC LIMIT 1",
                (room_id,),
            )
            row = await cur.fetchone()
            return row[0] if row else None