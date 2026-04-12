"""
ZARIS API — FastAPI Application Entry Point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes.buc import router as buc_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle hook: startup/shutdown."""
    print(f"[ZARIS API] Starting up... ({settings.PROJECT_NAME})")
    yield
    print("[ZARIS API] Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API para ZARIS Gestion Estatal - Modulo BUC",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas
app.include_router(buc_router)


# Health check
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "module": "BUC"
    }
