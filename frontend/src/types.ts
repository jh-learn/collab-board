// 图形元素的类型定义
export interface ShapeElement {
    id: string
    // 图形种类 
    // pen：自由笔迹，用 points 存路径点。
    // rect：矩形，用 width/height。
    // ellipse：椭圆，用 width/height 作为外接框。
    // text：文本，用 text 存内容。
    type: "pen" | "rect" | "ellipse" | "text"
    
    x: number
    y: number
    width?: number
    height?: number
    points?: number[]
    text?: string
    // 描边颜色
    stroke: string
    // 版本号，用于 LWW（Last-Write-Wins）冲突解决。
    version: number
    deleted?: boolean
}

// 评论的类型定义
export interface CommentElement {
    id: string
    // 评论所挂载的文件标识
    fileId: string
    lineNumber: number
    text: string
    author: string
    version: number
    deleted?:boolean
}

export interface RoomState {
    // 键是字符串、值是 ShapeElement 的对象
    shapes: Record<string, ShapeElement>
    comments:Record<string,CommentElement>
}

// 客户端发给服务端的“操作”
export interface OpPayload {
    opId: string
    // 操作作用于哪类元素
    elementType: "shape" | "comment"
    // 操作类型：
    action: "add" | "update" | "delete"
    // 数据类型
    data: ShapeElement | CommentElement
}

// 服务端发给客户端的“消息”
export interface ServerMessage {
    // 消息类别 snapshot：连接建立时服务端发的全量状态。payload 是 {shapes, comments, you}，客户端用它初始化画布。
    // op：一条操作广播。payload 是 OpPayload，可能是别人发的，也可能是自己发的（服务端会回显给发送者）。
    // cursor：别人的光标位置。payload 是 RemoteCursor。
    // pong：对客户端 ping 的回应。payload 是空对象，用于心跳/延迟检测。
    // error：服务端拒绝某个操作或输入非法。payload 是 {reason}，比如 {reason: "stale_version"}。
    type: "snapshot" | "op" | "cursor" | "pong" | "error";
    // 携带的具体数据
    payload: any;
}

// 别人的光标
export interface RemoteCursor {
    x: number;
    y: number;
    // 光标所属用户
    sender: string;
}