"""SKU helpers: TITLE-CODE-SIZE-COLOR e.g. SHIR-001-S-BLK"""
from __future__ import annotations

import re
import uuid
from datetime import datetime

CATALOG_COLORS = [
    ("Black", "BLK"),
    ("White", "WHT"),
    ("Navy", "NVY"),
    ("Olive", "OLV"),
    ("Beige", "BGE"),
    ("Green", "GRN"),
    ("Blue", "BLU"),
    ("Yellow", "YLW"),
    ("Pink", "PNK"),
    ("Cyan", "CYN"),
    ("Orange", "ORG"),
    ("Brown", "BRN"),
    ("Gray", "GRY"),
    ("Red", "RED"),
    ("Purple", "PPL"),
    ("Gold", "GLD"),
    ("Silver", "SLV"),
    ("Bronze", "BRZ"),
    ("Copper", "CPR"),
    ("Brass", "BRS"),
    ("Steel", "STL"),
    ("Iron", "IRN"),
    ("Multicolor", "MLT"),
]

DEFAULT_COLOR_CODES = {
    **{name: code for name, code in CATALOG_COLORS},
    "Grey": "GRY",
    "Gray/Silver": "GRY",
}

DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Fixed", "One Size", "Free Size"]


def extract_title_prefix(title: str) -> str:
    first = (title or "").strip().split()[0] if (title or "").strip() else "ITEM"
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", first).upper() or "ITEM"
    if len(cleaned) >= 4:
        return cleaned[:4]
    return cleaned.ljust(4, "_")


def format_code(n: int) -> str:
    return f"{max(1, int(n)):03d}"


def resolve_color_code(color_name: str, db_colors: list) -> str:
    raw = (color_name or "").strip()
    if not raw:
        return "XXX"
    for row in db_colors:
        if (row.code or "").upper() == raw.upper():
            return row.code.upper()
        if (row.name or "").lower() == raw.lower():
            return row.code.upper()
    mapped = DEFAULT_COLOR_CODES.get(raw) or DEFAULT_COLOR_CODES.get(raw.replace(" ", ""))
    if mapped:
        return mapped
    letters = re.sub(r"[^a-zA-Z]", "", raw).upper()
    return (letters[:3] or "XXX").ljust(3, "X")


def resolve_size_name(size_name: str, db_sizes: list) -> str:
    raw = (size_name or "").strip()
    if not raw:
        return "NA"
    for row in db_sizes:
        if (row.name or "").lower() == raw.lower():
            return row.name
    return raw


def generate_variant_sku(title_prefix: str, code: str, size_name: str, color_code: str) -> str:
    size = re.sub(r"\s+", "", (size_name or "NA").strip()) or "NA"
    color = (color_code or "XXX").strip().upper() or "XXX"
    return f"{title_prefix}-{code}-{size}-{color}"


def normalize_size_key(size: str) -> str:
    raw = re.sub(r"[\s_\-]+", "", (size or "").strip().lower())
    if not raw or raw in {"na", "n/a", "none"}:
        return "freesize"
    # Treat blank/NA aliases the same as free size for matching
    if raw in {"freesize", "onesize"}:
        return "freesize"
    return raw


def normalize_color_key(color: str) -> str:
    return re.sub(r"[\s_\-]+", "", (color or "").strip().lower())


def find_specification(db, Specification, product_id: str, color: str, size: str):
    color_key = normalize_color_key(color)
    size_key = normalize_size_key(size)
    for spec in db.query(Specification).filter_by(productId=product_id).all():
        if normalize_color_key(spec.color or "") != color_key:
            continue
        if normalize_size_key(spec.size or "") != size_key:
            continue
        return spec
    return None


def ensure_catalog(db, Color, Size):
    """Seed Color/Size rows. Only CATALOG_COLORS (unique codes) — never aliases like Grey/Gray/Silver."""
    from sqlalchemy.exc import IntegrityError

    now = datetime.utcnow()
    seen_codes: set[str] = set()

    for name, code in CATALOG_COLORS:
        if code in seen_codes:
            continue
        seen_codes.add(code)

        by_name = db.query(Color).filter(Color.name == name).first()
        if by_name:
            if by_name.code != code:
                code_taken = db.query(Color).filter(Color.code == code).first()
                if not code_taken or code_taken.id == by_name.id:
                    by_name.code = code
            continue

        by_code = db.query(Color).filter(Color.code == code).first()
        if by_code:
            continue

        try:
            with db.begin_nested():
                db.add(
                    Color(
                        id=str(uuid.uuid4()),
                        name=name,
                        code=code,
                        createdAt=now,
                        updatedAt=now,
                    )
                )
                db.flush()
        except IntegrityError:
            continue

    for name in DEFAULT_SIZES:
        existing = db.query(Size).filter(Size.name == name).first()
        if not existing:
            try:
                with db.begin_nested():
                    db.add(
                        Size(
                            id=str(uuid.uuid4()),
                            name=name,
                            createdAt=now,
                            updatedAt=now,
                        )
                    )
                    db.flush()
            except IntegrityError:
                continue

    db.flush()


def allocate_product_code(db, Product, title: str) -> tuple[str, str]:
    title_prefix = extract_title_prefix(title)
    db.execute(
        __import__("sqlalchemy").text("SELECT pg_advisory_xact_lock(hashtext(:p))"),
        {"p": title_prefix},
    )
    rows = db.execute(
        __import__("sqlalchemy").text(
            'SELECT MAX(CAST("code" AS INTEGER)) AS max FROM "Product" '
            'WHERE "titlePrefix" = :p AND "code" IS NOT NULL'
        ),
        {"p": title_prefix},
    ).fetchone()
    max_n = int(rows[0] or 0) if rows else 0
    return title_prefix, format_code(max_n + 1)
