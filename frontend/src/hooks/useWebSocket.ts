import { useCallback, useEffect, useRef, useState } from "react";
import { WS_BASE } from "../api/constants";
import { ServerMessage } from "../types";

export function useWebSocket(
    roomId: string, token: string,
    onMessage:(msg:ServerMessage) => void,
) {
    const wsRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false)
    useEffect(() => {
        if (!roomId || !token) return;
        const url = `${WS_BASE}/ws/${roomId}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(url);
        // wsRef.current 是 React useRef 返回对象的 .current 属性
        wsRef.current = ws;

        // 连接打开/关闭时更新 connected 状态，驱动 UI。
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        // 收到消息先 JSON.parse，成功就交给调用方。
        ws.onmessage = (e) => {
            try { onMessage(JSON.parse(e.data)) }
            catch (err) {console.log("bad ws message",err);}
        }

        // 每 20 秒发一次心跳，保持连接存活
        const ping = setInterval(() => {
            // 发送前检查 readyState === OPEN
            if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({type:"ping",payload:{}}))
        }, 20000)
        
        return () => { clearInterval(ping); ws.close() }   
    }, [roomId, token])

    const send = useCallback((type: string, payload: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN)
            wsRef.current.send(JSON.stringify({type,payload}))
    },[])
    
    return {send,connected}
}