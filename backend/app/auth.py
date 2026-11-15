from datetime import datetime,timedelta,timezone
from jose import jwt,JWTError
from app.config import settings

def create_token(room_id:str,subject:str) -> str:
    """签发token。

    参数:
        room_id: 这个 token 绑定哪个协同房间。
        subject: 客户端标识，写进标准声明 sub。
    返回:
        编码后的 JWT 字符串
    """
    now = datetime.now(timezone.utc)

    return jwt.encode(
        {
            "room_id": room_id,"sub": subject,"iat": now,
            "exp": now + timedelta(hours=24)
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algoritm
    )

def verify_token(token: str) -> dict | None:
    """校验并解析token"""
    try:
        return jwt.decode(token,settings.jwt_secret,algorithms=[settings.jwt_algoritm])
    except JWTError:
        return None