import logging
import time
import uuid
from decimal import Decimal

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Product, Category, Specification, ProductImage, Color, Size
from app.sku import (
    allocate_product_code,
    ensure_catalog,
    generate_variant_sku,
    normalize_color_key,
    normalize_size_key,
    resolve_color_code,
    resolve_size_name,
)

logger = logging.getLogger(__name__)

THROTTLE_MS = 0.02  # 20ms between product transactions


def _canonical_size(size: str) -> str:
    raw = (size or "").strip()
    return "Free Size" if normalize_size_key(raw) == "freesize" else raw


def _spec_key(color: str, size: str) -> str:
    return f"{normalize_color_key(color or '')}::{normalize_size_key(size or '')}"


def _sync_product_variants(
    db,
    *,
    product_id: str,
    title_prefix: str,
    code: str,
    variants_list: list,
    colors,
    sizes,
    add_qty: bool,
):
    """
    Apply variant quantities to specifications.
    When add_qty=True (existing product), ALWAYS add to current qty (never replace).
    """
    # Force merge for existing products — never replace stock on update.
    merge = bool(add_qty)

    incoming: list[dict] = []
    for variant in variants_list:
        v_color = (variant.get("color") or "").strip()
        v_size = _canonical_size(variant.get("size") or "")
        v_sku = (variant.get("sku") or "").strip()
        try:
            v_qty = max(0, int(float(variant.get("qty", 0) or 0)))
        except Exception:
            v_qty = 0
        if not v_color and not v_size and not v_sku:
            continue
        color_code = resolve_color_code(v_color, colors)
        size_name = resolve_size_name(v_size or "Free Size", sizes)
        sku = v_sku or generate_variant_sku(title_prefix, code, size_name, color_code)
        incoming.append(
            {
                "color": v_color,
                "size": v_size or "Free Size",
                "qty": v_qty,
                "sku": sku,
                "key": _spec_key(v_color, v_size),
            }
        )

    existing = db.query(Specification).filter_by(productId=product_id).all()
    by_key: dict[str, list] = {}
    by_sku: dict[str, Specification] = {}
    for spec in existing:
        key = _spec_key(spec.color or "", spec.size or "")
        by_key.setdefault(key, []).append(spec)
        if spec.sku:
            by_sku[spec.sku.strip().lower()] = spec

    # Collapse duplicate normalized keys (blank size + Free Size, etc.)
    for key, specs in list(by_key.items()):
        if len(specs) <= 1:
            continue
        keeper = next(
            (
                s
                for s in specs
                if normalize_size_key(s.size or "") == "freesize" and (s.size or "").strip()
            ),
            specs[0],
        )
        for dup in specs:
            if dup.id == keeper.id:
                continue
            keeper.qty = max(0, int(keeper.qty or 0)) + max(0, int(dup.qty or 0))
            if dup.sku and dup.sku.strip().lower() in by_sku:
                by_sku.pop(dup.sku.strip().lower(), None)
            db.delete(dup)
        by_key[key] = [keeper]
        if keeper.sku:
            by_sku[keeper.sku.strip().lower()] = keeper

    db.flush()

    if not incoming:
        specs = db.query(Specification).filter_by(productId=product_id).all()
        return sum(max(0, int(s.qty or 0)) for s in specs)

    for row in incoming:
        spec = None
        sku_l = (row["sku"] or "").strip().lower()
        if sku_l and sku_l in by_sku:
            spec = by_sku[sku_l]
        if spec is None:
            specs = by_key.get(row["key"]) or []
            if specs:
                spec = specs[0]

        if spec is not None:
            current = max(0, int(spec.qty or 0))
            new_qty = current + row["qty"] if merge else row["qty"]
            spec.qty = new_qty
            if row["color"]:
                spec.color = row["color"]
            if row["size"]:
                spec.size = row["size"]
            spec.sku = row["sku"]
            by_key[_spec_key(spec.color or "", spec.size or "")] = [spec]
            if spec.sku:
                by_sku[spec.sku.strip().lower()] = spec
            logger.warning(
                "[bulk-stock] %s %s/%s: %s -> %s (delta=%s) product=%s",
                "ADD" if merge else "SET",
                row["color"],
                row["size"],
                current,
                new_qty,
                row["qty"],
                product_id,
            )
            continue

        # Last resort: exact color/size (legacy rows)
        existing_exact = (
            db.query(Specification)
            .filter_by(productId=product_id, color=row["color"], size=row["size"])
            .first()
        )
        if existing_exact:
            current = max(0, int(existing_exact.qty or 0))
            new_qty = current + row["qty"] if merge else row["qty"]
            existing_exact.qty = new_qty
            existing_exact.sku = row["sku"]
            by_key[row["key"]] = [existing_exact]
            if existing_exact.sku:
                by_sku[existing_exact.sku.strip().lower()] = existing_exact
            logger.warning(
                "[bulk-stock] %s exact %s/%s: %s -> %s product=%s",
                "ADD" if merge else "SET",
                row["color"],
                row["size"],
                current,
                new_qty,
                product_id,
            )
            continue

        created = Specification(
            id=str(uuid.uuid4()),
            productId=product_id,
            color=row["color"],
            size=row["size"],
            qty=row["qty"],
            sku=row["sku"],
        )
        db.add(created)
        by_key[row["key"]] = [created]
        if created.sku:
            by_sku[created.sku.strip().lower()] = created
        logger.warning(
            "[bulk-stock] CREATE %s/%s qty=%s product=%s merge=%s",
            row["color"],
            row["size"],
            row["qty"],
            product_id,
            merge,
        )

    db.flush()
    specs = db.query(Specification).filter_by(productId=product_id).all()
    total = sum(max(0, int(s.qty or 0)) for s in specs)
    logger.warning(
        "[bulk-stock] product %s total stock=%s merge=%s",
        product_id,
        total,
        merge,
    )
    return total


@celery_app.task(bind=True, name="app.tasks.product_tasks.process_bulk_products_task")
def process_bulk_products_task(self, products_data: list):
    """
    Process bulk products one-by-one with advisory-locked SKU allocation
    and a small throttle between commits.
    """
    total = len(products_data)
    results = []
    success_count = 0
    failure_count = 0

    db = SessionLocal()
    try:
        ensure_catalog(db, Color, Size)
        db.commit()

        for idx, item in enumerate(products_data):
            self.update_state(
                state="PROGRESS",
                meta={
                    "current": idx + 1,
                    "total": total,
                    "message": f"Processing products ({idx + 1}/{total})...",
                },
            )

            title = (item.get("title") or "").strip()
            price_raw = item.get("price", 0)
            stock_raw = item.get("stock", 0)
            image_url = (item.get("image") or "").strip()
            category_name = (item.get("category") or item.get("categoryName") or "").strip()
            color = (item.get("color") or "").strip()
            size = (item.get("size") or "").strip()
            images_list = item.get("images") or []
            variants_list = item.get("variants") or []
            existing_product_id = (item.get("existingProductId") or item.get("productId") or "").strip()
            is_update = bool(item.get("isUpdate")) or bool(existing_product_id)

            if not title:
                results.append({"index": idx, "success": False, "error": "Title is required"})
                failure_count += 1
                continue

            try:
                price = Decimal(str(price_raw))
                if price <= 0:
                    raise ValueError("Price must be greater than 0")
            except Exception as e:
                results.append({"index": idx, "title": title, "success": False, "error": f"Invalid price: {e}"})
                failure_count += 1
                continue

            try:
                stock = int(stock_raw)
                if stock < 0:
                    stock = 0
            except Exception:
                stock = 0

            if variants_list:
                try:
                    stock = sum(max(0, int(v.get("qty", 0) or 0)) for v in variants_list)
                except Exception:
                    pass

            try:
                category_id = None
                if category_name:
                    cat = db.query(Category).filter(Category.name.ilike(category_name)).first()
                    if cat:
                        category_id = cat.id

                if not image_url and images_list:
                    image_url = images_list[0].get("url", "")
                if not image_url:
                    image_url = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop"

                if not color and variants_list:
                    color = (variants_list[0].get("color") or "").strip()
                if not size and variants_list:
                    size = (variants_list[0].get("size") or "").strip()

                colors = db.query(Color).all()
                sizes = db.query(Size).all()

                product = None
                sku_hint = (item.get("sku") or "").strip()
                updating_existing = False

                if is_update and existing_product_id:
                    product = db.query(Product).filter(Product.id == existing_product_id).first()

                # Fallbacks so "Update Product" rows never silently create duplicates
                if product is None and sku_hint:
                    by_sku = (
                        db.query(Specification)
                        .filter(Specification.sku.ilike(sku_hint))
                        .first()
                    )
                    if by_sku:
                        product = db.query(Product).filter(Product.id == by_sku.productId).first()
                        is_update = True
                    else:
                        parts = sku_hint.upper().split("-")
                        if len(parts) >= 2 and parts[1].isdigit():
                            product = (
                                db.query(Product)
                                .filter(
                                    Product.titlePrefix == parts[0],
                                    Product.code == parts[1].zfill(3),
                                )
                                .first()
                            )
                            if product:
                                is_update = True

                if product is None:
                    product = db.query(Product).filter(Product.title.ilike(title)).first()
                    if product:
                        is_update = True

                if is_update and product is None:
                    results.append(
                        {
                            "index": idx,
                            "title": title,
                            "success": False,
                            "error": f"Product to update not found (sku={sku_hint or 'n/a'})",
                        }
                    )
                    failure_count += 1
                    continue

                if product is not None:
                    updating_existing = True
                    product.price = price
                    # Never overwrite stock from payload — always recompute after variant merge
                    if image_url and not updating_existing:
                        product.image = image_url
                    if category_id:
                        product.categoryId = category_id
                    if color:
                        product.color = color
                    if size:
                        product.size = size
                    if not product.titlePrefix or not product.code:
                        title_prefix, code = allocate_product_code(db, Product, title)
                        product.titlePrefix = title_prefix
                        product.code = code
                    db.flush()
                    product_id = product.id
                    title_prefix = product.titlePrefix
                    code = product.code
                else:
                    title_prefix, code = allocate_product_code(db, Product, title)
                    new_prod = Product(
                        id=str(uuid.uuid4()),
                        title=title,
                        titlePrefix=title_prefix,
                        code=code,
                        price=price,
                        stock=stock,
                        image=image_url,
                        color=color or None,
                        size=size or None,
                        isActive=True,
                        categoryId=category_id,
                    )
                    db.add(new_prod)
                    db.flush()
                    product_id = new_prod.id

                # Updates keep existing images (do not append duplicates).
                if updating_existing:
                    seen_urls: set[str] = set()
                    for img in (
                        db.query(ProductImage)
                        .filter_by(productId=product_id)
                        .order_by(ProductImage.sortOrder.asc())
                        .all()
                    ):
                        if img.url in seen_urls:
                            db.delete(img)
                        else:
                            seen_urls.add(img.url)
                elif images_list:
                    for s_idx, img_item in enumerate(images_list):
                        u = img_item.get("url")
                        if u:
                            db.add(
                                ProductImage(
                                    id=str(uuid.uuid4()),
                                    productId=product_id,
                                    url=u,
                                    color=img_item.get("color", "") or "",
                                    sortOrder=s_idx,
                                )
                            )

                sync_variants = variants_list
                if not sync_variants and (color or size):
                    sync_variants = [{"color": color, "size": size, "qty": stock}]

                if sync_variants:
                    stock = _sync_product_variants(
                        db,
                        product_id=product_id,
                        title_prefix=title_prefix,
                        code=code,
                        variants_list=sync_variants,
                        colors=colors,
                        sizes=sizes,
                        add_qty=updating_existing,
                    )
                elif updating_existing:
                    # Keep existing variant stock; only refresh product.stock aggregate
                    specs = db.query(Specification).filter_by(productId=product_id).all()
                    stock = sum(max(0, int(s.qty or 0)) for s in specs)

                product_row = db.query(Product).filter(Product.id == product_id).first()
                if product_row is not None:
                    product_row.stock = stock

                db.commit()
                logger.warning(
                    "[bulk-stock] committed %s updated=%s stock=%s",
                    title,
                    updating_existing,
                    stock,
                )
                results.append(
                    {
                        "index": idx,
                        "title": title,
                        "id": product_id,
                        "success": True,
                        "updated": updating_existing,
                        "stock": stock,
                        "baseSku": f"{title_prefix}-{code}",
                    }
                )
                success_count += 1
                time.sleep(THROTTLE_MS)

            except Exception as e:
                db.rollback()
                results.append({"index": idx, "title": title, "success": False, "error": str(e)})
                failure_count += 1

        return {
            "total": total,
            "success_count": success_count,
            "failure_count": failure_count,
            "results": results,
        }
    finally:
        db.close()
