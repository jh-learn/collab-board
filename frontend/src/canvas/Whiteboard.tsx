import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Ellipse } from "react-konva";
import { RemoteCursor, ServerMessage, ShapeElement } from "../types";
import { isStale, makeId } from "./shapeUtils";
import { Toolbar } from "./Toolbar";

type Tool = "pen" | "rect" | "ellipse" | "select";

interface Props {
    send: (type: string, payload: any) => void;
    onRemoteMessage: (cb: (msg: ServerMessage) => void) => void;
    roomId: string;
}

export function Whiteboard({ send, onRemoteMessage, roomId }: Props) {
    // shapes：所有图形
    const [shapes, setShapes] = useState<Record<string, ShapeElement>>({})
    // tool：当前工具
    const [tool, setTool] = useState<Tool>("pen")
    // cursors：远程光标
    const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
    
    // versionRef：本地版本计数器
    const versionRef = useRef(0);
    // 当前正在画的图形（鼠标按下到松开之间）。
    const drawingRef = useRef<ShapeElement | null>(null);
    // Konva Stage 实例
    const stageRef = useRef<any>(null);
    // 外层 div，用于计算画布尺寸
    const containerRef = useRef<HTMLDivElement>(null);
    // 画布宽高
    const [size, setSize] = useState({ w: 800, h: 600 });

    // 尺寸自适应 
    useEffect(() => {
        // 监听窗口 resize，把容器实际尺寸同步到 size state，驱动 Stage 重绘。
        // onResize() 先手动调一次，确保首次渲染就拿正确尺寸。
        // cleanup 移除监听，防止泄漏
        const onResize = () => {
            const el = containerRef.current;
            if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
        };
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [])
    
    // 消息处理
    useEffect(() => {
        onRemoteMessage((msg: ServerMessage) => {
            // snapshot处理
            if (msg.type === "snapshot") {
                const next = (msg.payload?.shapes || {}) as Record<string, ShapeElement>;
                setShapes(next);
                const maxV = Object.values(next).reduce((m, s) => Math.max(m, s.version || 0), 0);
                versionRef.current = Math.max(versionRef.current, maxV);
            } else if (msg.type === "op" && msg.payload.elementType === "shape") {
                // op 处理 
                const { action, data } = msg.payload as { action: "add" | "update" | "detele"; data: ShapeElement };
                setShapes((prev) => {
                    if (action === "detele") {
                        const n = { ...prev };
                        delete n[data.id];
                        return n;
                    }
                    // 先用 isStale 判断，过期就原样返回 prev（不触发重渲染），否则用新数据覆盖并更新 versionRef。
                    if (isStale(prev, data)) return prev;
                    versionRef.current = Math.max(versionRef.current, data.version || 0);
                    return { ...prev, [data.id]: data };
                })
            } else if (msg.type === "cursor") {
                // cursor 处理
                // 收到光标消息，以 sender 为键更新 cursors。同一个用户的光标反复更新同一个键，所以字典不会无限增长
                const { x, y, sender } = msg.payload;
                if (sender) setCursors((c) => ({ ...c, [sender]: { x, y, sender } }));
            }
        })
    }, [onRemoteMessage]);

    // 递增并返回本地版本号
    const nextVersion = () => { versionRef.current += 1; return versionRef.current; }
    // 从 Konva Stage 取当前鼠标/触摸位置（画布坐标系），取不到时返回 {x:0, y:0} 兜底
    const pointer = () => stageRef.current?.getPointerPosition() || { x: 0, y: 0 };

    // 把完成的图形作为 add 操作发出去。
    // opId 用 id_version 组合，保证同一次绘制的 opId 唯一
    const commit = (shape: ShapeElement) => {
        send("op", { opId: `${shape.id}_${shape.version}`, elementType: "shape", action: "add", data: shape });
    }

    // 开始绘制
    const onDown = () => {
        // select 工具不绘制，直接返回
        if (tool === "select") return;
        const pos = pointer();
        const shape: ShapeElement = {
            id: makeId(),
            type: tool === "pen" ? "pen" : tool === "rect" ? "rect" : "ellipse",
            x: pos.x, y: pos.y,
            points: tool === "pen" ? [pos.x, pos.y] : undefined,
            width: tool !== "pen" ? 0 : undefined,
            height: tool !== "pen" ? 0 : undefined,
            stroke: "#3b82f6",
            version: nextVersion(),
        };
        drawingRef.current = shape;
        setShapes((prev) => ({ ...prev, [shape.id]: shape }));
    };

    // 绘制中更新
    const onMove = () => {
        const pos = pointer()
        send("cursor", { x: pos.x, y: pos.y });
        const cur = drawingRef.current;
        if (!cur) return;
        if (cur.type === "pen") cur.points = [...(cur.points || []), pos.x, pos.y];
        else { cur.width = pos.x - cur.x; cur.height = pos.y - cur.y; }
        setShapes((prev) => ({ ...prev, [cur.id]: { ...cur } }));
    }

    // 结束绘制并提交
    const onUp = () => {
        const cur = drawingRef.current;
        if (cur) { commit(cur); drawingRef.current = null; }
    }

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
            <Toolbar tool={tool} onChange={setTool} />
            <div style={{ position: "absolute", top: 12, right: 12, fontSize: 12, color: "#6b7280" }}>
                room {roomId.slice(0, 8)} · v{versionRef.current}
            </div>
            <Stage ref={stageRef} width={size.w} height={size.h}
                onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
                onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
                <Layer>
                    {Object.values(shapes).filter((s) => !s.deleted).map((s) => {
                        if (s.type === "pen") {
                            return <Line key={s.id} points={s.points || []} stroke={s.stroke}
                                strokeWidth={2} lineCap="round" lineJoin="round" />;
                        }
                        if (s.type === "rect") {
                            return <Rect key={s.id} x={s.x} y={s.y}
                                width={s.width || 0} height={s.height || 0}
                                stroke={s.stroke} strokeWidth={2} />;
                        }
                        return <Ellipse key={s.id}
                            x={s.x + (s.width || 0) / 2} y={s.y + (s.height || 0) / 2}
                            radiusX={Math.abs((s.width || 0) / 2)} radiusY={Math.abs((s.height || 0) / 2)}
                            stroke={s.stroke} strokeWidth={2} />;
                    })}
                    {Object.values(cursors).map((c) => (
                        <Line key={c.sender}
                            points={[c.x - 6, c.y, c.x + 6, c.y, c.x, c.y + 12, c.x - 6, c.y]}
                            stroke="#ef4444" strokeWidth={1} closed fill="#ef4444" opacity={0.8} />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
}