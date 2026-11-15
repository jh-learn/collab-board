import json
from app.config import settings
from app.redis_client import (
    get_redis, stream_key, pubsub_channel,
    json_set_element, json_delete_element, json_get_element, ensure_state,
)

async def process_op(room_id:str,payload:dict) -> tuple[bool,str | None]:
    """LWW 校验 -> 写 RedisJSON -> 写 Stream -> Pub/sub 广播"""
    r = get_redis()
    await ensure_state(room_id)

    element = payload["data"]
    etype = payload["elementType"]
    action = payload["action"]
    element_id = element["id"]
    incoming_version = int(element.get("version",0))

    # LWW 校验：读当前值，如果已存在且版本不低于来者，拒绝。这是核心冲突解决逻辑。
    existing = await json_get_element(room_id,etype,element_id)
    if existing and int(existing.get("version",0)) >= incoming_version:
        return False,"stale_version"

    if action == "delete":
        await json_delete_element(room_id,etype,element_id)
        element["deleted"] = True
    else:
        await json_set_element(room_id,etype,element)
    
    # 把操作追加到 Redis Stream，带 maxlen 和 approximate=True（允许近似裁剪，性能更好）。这里存的是原始 payload。
    await r.xadd(
        stream_key(room_id),
        {"opId":payload["opId"],"payload":json.dumps(payload,ensure_ascii=False)},
        maxlen=settings.stream_maxlen,approximate=True
    )

    # 广播给订阅者。注意广播的是原始 payload，不是加了 deleted 标记的那个 element。
    await r.publish(
        pubsub_channel(room_id),
        json.dumps({"type":"op","payload":payload},ensure_ascii=False)
    )

    return True,None