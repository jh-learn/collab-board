import { useState } from "react";
import { createRoom, joinRoom } from "../api/rest";

// Props 只有一个 onEnter 回调。Landing 不自己决定进入房间后去哪，只负责“拿到 roomId 和 token 后通知父组件”。导航权留在 App，组件职责单一。
interface Props { onEnter: (roomId: string, token: string) => void }

export function Landing({ onEnter }: Props) {
    // 参数解构 从 props 对象里取出 onEnter 字段。
    
    const [name, setName] = useState("user-" + Math.random().toString(36).slice(2, 6));
    
    const [roomId, setRoomId] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const doCreate = async () => {
        // 每次请求前清空旧错误、置 loading。
        setErr(null); setLoading(true);

        try { const r = await createRoom(name); onEnter(r.room_id, r.token); }
        catch (e: any) { setErr(e.message || "create failed"); }
        finally { setLoading(false); }
    };
    
    const doJoin = async () => {
        // 每次请求前清空旧错误、置 loading。
        setErr(null); setLoading(true);

        try { const r = await joinRoom(roomId, name, code || undefined); onEnter(r.room_id, r.token); }
        catch (e: any) { setErr(e.message || "join failed"); }
        finally { setLoading(false); }
    };
    
    return (
        <div className="landing">
            <h1>Collab Board</h1>
            <div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="昵称" /></div>
            <div><button disabled={loading} onClick={doCreate}>创建房间</button></div>
            <div style={{ display: "flex", gap: 8 }}>
                <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="room_id" />
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="邀请码(可选)" />
                <button disabled={loading || !roomId} onClick={doJoin}>加入</button>
            </div>
            {err && <div style={{ color: "#ef4444" }}>{err}</div>}
            </div>
    );
}