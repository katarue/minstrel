import io
import hashlib
import requests
from PIL import Image
from utils.db import get_client
from utils.config import USER_AGENT

BUCKET = "event-images"
MAX_WIDTH = 800
JPEG_QUALITY = 85


def _ensure_bucket() -> None:
    db = get_client()
    try:
        db.storage.create_bucket(BUCKET, options={"public": True})
    except Exception:
        pass  # already exists


def process_event_image(image_url: str, storage_key: str) -> str | None:
    """Download, resize, upload. Returns public URL or None on failure."""
    try:
        raw = _download(image_url)
        resized = _resize(raw)
        return _upload(resized, storage_key)
    except Exception as e:
        print(f"[image] failed {image_url}: {e}")
        return None


def _download(url: str) -> bytes:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
    resp.raise_for_status()
    return resp.content


def _resize(img_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


def _upload(img_bytes: bytes, storage_key: str) -> str | None:
    _ensure_bucket()
    db = get_client()
    db.storage.from_(BUCKET).upload(
        storage_key,
        img_bytes,
        {"content-type": "image/jpeg", "upsert": "true"},
    )
    return db.storage.from_(BUCKET).get_public_url(storage_key)


def image_storage_key(source_url: str) -> str:
    """Deterministic storage key derived from source URL."""
    h = hashlib.md5(source_url.encode()).hexdigest()[:12]
    return f"flyer/{h}.jpg"
