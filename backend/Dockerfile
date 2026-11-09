FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.8 /uv /bin/uv
WORKDIR /backend
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY . .
ARG APP_VERSION=dev
ENV PATH=/backend/.venv/bin:$PATH APP_VERSION=$APP_VERSION OTEL_SERVICE_NAME=backend OTEL_SDK_DISABLED=true \
    OTEL_RESOURCE_ATTRIBUTES=service.version=$APP_VERSION,deployment.environment.name=hackathon \
    OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true \
    OTEL_PYTHON_FASTAPI_EXCLUDED_URLS=healthz,readyz
USER 1000
EXPOSE 8000
CMD ["opentelemetry-instrument", "python", "-m", "roompass", "api"]
