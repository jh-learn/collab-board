import { CommentElement } from "../types";

interface Props {
    comments: Record<string, CommentElement>;
    selectedLine: number | null;
    onDelete: (id: string) => void;
}

export function CommentSidebar({ comments, selectedLine, onDelete }: Props) {
    const list = Object.values(comments)
        .filter((c) => !c.deleted)
        .sort((a, b) => a.lineNumber - b.lineNumber);
    
    return (
        <div style={{ flex: 1, padding: 12, overflowY: "auto", borderTop: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: "0 0 8px" }}>评论 {selectedLine ? `· 第 ${selectedLine} 行` : ""}</h3>
            {list.length === 0 && <div style={{ color: "#9ca3af", fontSize: 13 }}>暂无评论</div>}
            {list.map((c) => (
                <div key={c.id}
                    style={{
                        border: "1px solid #e5e7eb", borderRadius: 6, padding: 8,
                        marginBottom: 8, background: c.lineNumber === selectedLine ? "#f0f7ff" : "#fff"
                    }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                        第 {c.lineNumber} 行 · {c.author}
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>{c.text}</div>
                    <button onClick={() => onDelete(c.id)}
                        style={{
                            fontSize: 12, border: "none", background: "transparent",
                            color: "#ef4444", cursor: "pointer"
                        }}>
                        删除
                    </button>
                </div>
            ))}
        </div>
    );
}