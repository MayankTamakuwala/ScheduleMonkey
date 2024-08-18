FROM python:3.9.6-slim

WORKDIR /app

COPY main.py .
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD fastapi run --port $PORT