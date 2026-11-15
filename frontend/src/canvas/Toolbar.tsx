type Tool = "pen" | "rect" | "ellipse" | "select";
interface Props { tool: Tool; onChange: (t: Tool) => void; }

const tools: Array<{ key: Tool; icon: string; label: string }> = [
  { key: "pen", icon: "✏️", label: "钢笔" },
  { key: "rect", icon: "▭", label: "矩形" },
  { key: "ellipse", icon: "◯", label: "椭圆" },
  { key: "select", icon: "↖️", label: "选择" },
];

export function Toolbar({ tool, onChange }: Props) {
    return (
        <div className="toolbar">
            {tools.map((t) => (
                <button key={t.key} title={t.label}
                        className={tool === t.key ? "active" : ""}
                         onClick={() => onChange(t.key)}>
                    {t.icon}
                </button>
            ))}
        </div>
    )
}
