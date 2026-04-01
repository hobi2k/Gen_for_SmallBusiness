FROM python:3.10-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
  && pip install -r requirements.txt

COPY workers/image_worker ./workers/image_worker

EXPOSE 8001

CMD ["uvicorn", "workers.image_worker.app:app", "--host", "0.0.0.0", "--port", "8001"]
