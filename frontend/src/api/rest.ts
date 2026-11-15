import { API_BASE } from "./constants";

// 创建房间的响应结构
export interface CreateRoomResp {
    room_id: string;
    invite_code: string;
    token: string;
}

// 创建房间
export async function createRoom(name:string) : Promise<CreateRoomResp>{
    const res = await fetch(`${API_BASE}/api/v1/rooms`, {
        method: "post", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    })
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// 加入房间
export async function joinRoom(room_id: string, name: string, invite_code?: string)
  : Promise<{ room_id: string; token: string }> {
  const res = await fetch(`${API_BASE}/api/v1/rooms/join`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_id, name, invite_code }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}