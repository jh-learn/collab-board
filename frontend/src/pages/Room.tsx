import { useCallback, useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { ServerMessage,CommentElement } from "../types";
import { Whiteboard } from "../canvas/Whiteboard";
import { CodeReviewEditor } from "../editor/CodeReviewEditor";

interface Props { roomId: string; token: string; onLeave: () => void; }

export function Room({ roomId, token, onLeave }: Props) {
    const listeners = useRef<Set<(msg: ServerMessage) => void>>(new Set());
    const [comments, setComments] = useState<Record<string, CommentElement>>({});
    const versionRef = useRef(0);
    const [tab, setTab] = useState<"board" | "review">("board");

    // 消息处理回调
    const dispatch = useCallback((msg: ServerMessage) => {
        if (msg.type === "snapshot") {
            const cs = (msg.payload?.comments || {}) as Record<string, CommentElement>;
            setComments(cs);
            const maxV = Object.values(cs).reduce((m, c) => Math.max(m, c.version || 0), 0);
            versionRef.current = Math.max(versionRef.current, maxV);
        } else if (msg.type === "op" && msg.payload.elementType === "comment") {
            const { action, data } = msg.payload as { action: "add" | "update" | "delete"; data: CommentElement };
            setComments((prev) => {
                if (action === "delete") return { ...prev, [data.id]: { ...data, deleted: true } };
                const exist = prev[data.id];
                if (exist && exist.version >= data.version) return prev;
                versionRef.current = Math.max(versionRef.current, data.version || 0);
                return { ...prev, [data.id]: data };
            });
        }
        for (const cb of listeners.current) cb(msg);
    }, []);


    // 解构了 send,connected
    const { send,connected } = useWebSocket(roomId, token, dispatch);

    // 订阅入口
    const registerRemote = useCallback((cb: (msg: ServerMessage) => void) => {
        listeners.current.add(cb);
    }, []);

    return (
        <div className="room">
            <div className="room-header">
                <strong>Room:</strong> <code>{roomId}</code>
                <span style={{ color: connected ? "#10b981" : "#ef4444", fontSize: 12 }}>
                    {connected ? "● connected" : "● disconnected"}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button onClick={() => setTab("board")} disabled={tab === "board"}>白板</button>
                    <button onClick={() => setTab("review")} disabled={tab === "review"}>代码评审</button>
                    <button onClick={onLeave}>退出</button>
                </div>
            </div>
            <div className="room-body">
                {tab === "board" ? (
                    <div className="room-left" style={{ flex: 1 }}>
                        <Whiteboard send={send} roomId={roomId} onRemoteMessage={registerRemote} />
                    </div>
                ) : (
                    <div className="room-right" style={{ flex: 1 }}>
                        <CodeReviewEditor comments={comments} setComments={setComments}
                            send={send} versionRef={versionRef} />
                    </div>
                )}
            </div>
        </div>
    );
}