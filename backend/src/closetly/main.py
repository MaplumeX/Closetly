import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .bootstrap import cleanup_orphan_images, ensure_admin, run_migrations
from .config import Settings, get_settings
from .db import make_engine, make_sessionmaker
from .ratelimit import LoginRateLimiter
from .images import ImageStore
from .routers import admin, auth, colors, images, items, outfits, recommend, wear_logs

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


class SPAStaticFiles(StaticFiles):
    """前端是单页应用：找不到的非 API 路径一律返回 index.html，交给前端路由处理。"""

    async def get_response(self, path, scope):  # noqa: ANN001
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404)
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            return await super().get_response("index.html", scope)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.images_dir.mkdir(parents=True, exist_ok=True)
        run_migrations(settings.database_url)
        with app.state.sessionmaker() as db:
            ensure_admin(db, settings)
            cleanup_orphan_images(db, app.state.image_store)
        yield
        app.state.engine.dispose()

    app = FastAPI(title="Closetly", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.sessionmaker = make_sessionmaker(app.state.engine)
    app.state.image_store = ImageStore(settings.images_dir)
    app.state.login_limiter = LoginRateLimiter(
        settings.login_max_failures, settings.login_window_seconds
    )

    @app.get("/api/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(images.router)
    app.include_router(items.router)
    app.include_router(colors.router)
    app.include_router(outfits.router)
    app.include_router(wear_logs.router)
    app.include_router(recommend.router)

    static_dir: Path | None = settings.static_dir
    if static_dir and (static_dir / "index.html").is_file():
        app.mount("/", SPAStaticFiles(directory=static_dir, html=True), name="spa")

    return app
