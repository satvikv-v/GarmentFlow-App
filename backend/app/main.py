"""
GarmentFlow FastAPI application entrypoint.

Registers all routers and exposes the ASGI ``app`` object that Uvicorn runs.

Start the dev server from the backend/ directory:
    uvicorn app.main:app --reload

Interactive docs available at:
    http://127.0.0.1:8000/docs   (Swagger UI)
    http://127.0.0.1:8000/redoc  (ReDoc)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.ml import predictor
from app.api.auth import router as auth_router
from app.api.customers import router as customers_router
from app.api.orders import router as orders_router
from app.api.production import router as production_router
from app.api.inventory import router as inventory_router
from app.api.suppliers import router as suppliers_router
from app.api.workers import router as workers_router
from app.api.dispatch import router as dispatch_router
from app.api.dashboard import router as dashboard_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup/shutdown lifecycle for the GarmentFlow API.

    On startup: load the delay risk ML model from disk (if present).
    If the model file is missing the server still starts, but the
    /delay-risk endpoint will return 503 until the model is trained.
    """
    predictor.load_model()
    yield  # application runs
    # (no teardown needed)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    lifespan=lifespan,
    description=(
        "GarmentFlow backend API — garment factory management system."
    ),
)

# ---------------------------------------------------------------------------
# CORS — permissive for local development; tighten for production.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router)
app.include_router(customers_router)
app.include_router(orders_router)
app.include_router(production_router)
app.include_router(inventory_router)
app.include_router(suppliers_router)
app.include_router(workers_router)
app.include_router(dispatch_router)
app.include_router(dashboard_router)


# ---------------------------------------------------------------------------
# Health-check — useful for Docker/CI and quick smoke tests.
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
def health() -> dict:
    """Returns 200 OK if the server is reachable."""
    return {"status": "ok", "project": settings.PROJECT_NAME}
