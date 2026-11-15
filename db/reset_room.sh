#!/usr/bin/env bash
# 用法: ./db/reset_room.sh R1
ROOM="${1:?usage: reset_room.sh <room_id>}"
redis-cli DEL "room:${ROOM}:state" > /dev/null
echo "state cleared for ${ROOM}; stream preserved: $(redis-cli XLEN room:${ROOM}:stream)"