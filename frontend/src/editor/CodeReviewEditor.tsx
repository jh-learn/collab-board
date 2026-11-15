import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useCallback, useRef, useState } from "react";
import { CommentElement } from "../types";
import { makeId } from "../canvas/shapeUtils";
import { CommentSidebar } from "./CommentSidebar";

loader.config({ monaco });

// 示例代码
const DEFAULT_CODE = `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in seen:
            return [seen[diff], i]
        seen[n] = i
    return []
`;

interface Props {
    comments: Record<string, CommentElement>;
    // React.Dispatch<A>：接收 A 类型参数的函数。
    // React.SetStateAction<Record<...>>：要么直接传新字典，要么传 (prev) => 新字典 的函数。
    setComments: React.Dispatch<React.SetStateAction<Record<string, CommentElement>>>;
    send: (type: string, payload: any) => void;
    // 一个带可读写 .current 属性的引用对象，.current 的类型是 number。
    versionRef: React.MutableRefObject<number>;
}

export function CodeReviewEditor({ comments, setComments, send, versionRef }: Props) {
    // 用户点击的行号
    const [selectedLine, setSelectedLine] = useState<number | null>(null);
    // 评论输入框的内容
    const [draft, setDraft] = useState("");
    // Monaco 编辑器实例
    const editorRef = useRef<any>(null);

    // 版本号
    const nextVersion = () => { versionRef.current += 1; return versionRef.current; };

    // 绑定编辑器点击
    const onMount = useCallback((editor: any) => {
        // 保存编辑器实例
        editorRef.current = editor;
        // 监听 onMouseDown，从事件里取 e.target.position.lineNumber（点击的行号），更新 selectedLine。
        editor.onMouseDown((e: any) => {
            const pos = e.target.position;
            if (pos) setSelectedLine(pos.lineNumber);
        });
    }, []);

    // 提交评论
    const submit = () => {
        if (!selectedLine || !draft.trim()) return;
        const c: CommentElement = {
            id: makeId(), fileId: "default", lineNumber: selectedLine,
            text: draft.trim(), author: "you", version: nextVersion(),
        };
        // 乐观更新：先本地加评论，用户立刻看到
        setComments((prev) => ({ ...prev, [c.id]: c }));
        // 发送 op
        send("op", { opId: `${c.id}_${c.version}`, elementType: "comment", action: "add", data: c });
        // 清空输入框
        setDraft("");
    };

    // 删除评论
    const remove = (id: string) => {
        // 取已有评论，不存在就返回。
        const exist = comments[id];
        if (!exist) return;
        // 构造删除标记：复制原评论
        const del: CommentElement = { ...exist, deleted: true, version: nextVersion() };
        // 本地保留评论但标记 deleted: true，而不是从 comments 里删掉
        setComments((prev) => ({ ...prev, [id]: del }));
        // 发送 action: "delete"
        send("op", { opId: `${id}_${del.version}`, elementType: "comment", action: "delete", data: del });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 2, minHeight: 200 }}>
                <Editor height="100%" defaultLanguage="python" value={DEFAULT_CODE} onMount={onMount}
                    options={{
                        readOnly: true, lineNumbers: "on", glyphMargin: true,
                        fontSize: 13, minimap: { enabled: false }
                    }} />
            </div>
            {selectedLine && (
                <div style={{ padding: 8, borderTop: "1px solid #e5e7eb", background: "#fafafa" }}>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                        placeholder={`评论第 ${selectedLine} 行...`}
                        style={{ width: "100%", fontSize: 13, padding: 6 }} />
                    <button onClick={submit} style={{ marginTop: 4 }}>提交评论</button>
                </div>
            )}
            <CommentSidebar comments={comments} selectedLine={selectedLine} onDelete={remove} />
        </div>
    );
}