# AegisCare backend (FastAPI + LangGraph agents + Playwright scrapers) for cloud hosting.
# The frontend is published separately on GitHub Pages.
# Debian 12 (bookworm): fully supported by Playwright's --with-deps installer.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PATIENT_SCRAPE_HEADLESS=true

WORKDIR /app

# xvfb gives the Google Maps review scraper (which opens a visible browser) a virtual screen.
# libatomic1 is needed by Playwright's bundled Node.js (missing from the slim image).
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xauth libatomic1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install --with-deps chromium

COPY . .

EXPOSE 8000
# Render and most hosts pass the port in $PORT.
CMD ["sh", "-c", "xvfb-run -a uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
