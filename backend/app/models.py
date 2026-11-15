from typing import Literal,Optional
from pydantic import BaseModel

class ShapeElement(BaseModel):
    """图形元素模型"""
    id: str
    # 图形类型，只允许四种：手绘笔迹 / 矩形 / 椭圆 / 文本。
    type: Literal["pen","rect","ellipse","text"]
    x: float
    y: float
    # 尺寸，可省略。默认None
    width: Optional[float] = None
    height: Optional[float] = None
    # 手绘点集，只对 type="pen" 有意义。其他类型用不到
    points: Optional[list[float]] = None
    # 文本内容，只对 type="text" 有意义。其它类型留 None。
    text: Optional[str] = None
    # 描边颜色
    stroke: str = '#3b82f6'
    # 版本控制。用于乐观并发控制 / 冲突检测。
    version: int = 0
    # 软删除标记
    deleted: bool = False


class CommentElement(BaseModel):
    """评论元素模型"""
    id: str
    # 评论挂在哪个文件上，默认 "default"（单文件场景的兜底）。
    filedId: str = "default"
    # 评论对应的代码行号
    lineNumber: int
    # 评论内容
    text: str
    # 评论作者
    author: str
    # 版本控制。用于乐观并发控制 / 冲突检测。
    version: int = 0
    # 软删除标记
    deleted: bool = False

class OpPayload(BaseModel):
    """操作载荷模型"""
    opId: str
    # 被操作的对象种类，二选一。决定 data 应该按哪个模型解析。
    elementType: Literal["shape","comment"]
    # 操作类型
    action: Literal["add","update","delete"]
    data: dict

class CreateRoomRequest(BaseModel):
    """创建房间的请求体"""
    name: Optional[str] = "creator"

class JoinRoomRequest(BaseModel):
    """加入房间请求体"""
    room_id: Optional[str] = None
    # 邀请码
    invite_code: Optional[str] = None
    name: Optional[str] = "anon"