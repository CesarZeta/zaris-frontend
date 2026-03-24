from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
import app.models.crm  # noqa: F401 — registra modelos CRM en Base.metadata al inicio

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API integration for BUP, CRM, and Agenda modular architecture.",
    version="1.0.0"
)

# CORS middleware to allow requests from the vanilla JS frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def root():
    return {"message": "ZARIS API is running."}

from app.api.routes import auth
from app.api.routes import crm

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(crm.router,  prefix="/api/crm",  tags=["CRM"])
