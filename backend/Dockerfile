FROM python:3.14-slim

RUN pip install uv -i https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app

COPY pyproject.toml uv.lock ./
ENV UV_DEFAULT_INDEX=https://mirrors.aliyun.com/pypi/simple/
RUN uv sync --frozen --no-cache

COPY app ./app

EXPOSE 8000
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]