import re
import uuid
from decimal import Decimal
from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Product, Category, Specification, ProductImage

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")

@celery_app.task(bind=True, name="app.tasks.product_tasks.process_bulk_products_task")
def process_bulk_products_task(self, products_data: list):
    """
    Takes parsed and validated product data from NextJS,
    processes them one product at a time with validations,
    and saves to Neon PostgreSQL database.
    """
    total = len(products_data)
    results = []
    success_count = 0
    failure_count = 0

    db = SessionLocal()
    try:
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
            description = (item.get("description") or title).strip()
            category_name = (item.get("category") or item.get("categoryName") or "").strip()
            color = (item.get("color") or "").strip()
            size = (item.get("size") or "").strip()
            images_list = item.get("images") or []
            variants_list = item.get("variants") or []

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

            # Prefer sum of variant quantities when variants are provided
            if variants_list:
                try:
                    stock = sum(max(0, int(v.get("qty", 0) or 0)) for v in variants_list)
                except Exception:
                    pass

            try:
                category_id = None
                if category_name:
                    cat = db.query(Category).filter(Category.name.ilike(category_name)).first()
                    if not cat:
                        cat_slug = slugify(category_name)
                        cat = Category(
                            id=str(uuid.uuid4()),
                            name=category_name,
                            slug=cat_slug,
                        )
                        db.add(cat)
                        db.flush()
                    category_id = cat.id

                if not image_url and images_list:
                    image_url = images_list[0].get("url", "")
                if not image_url:
                    image_url = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop"

                if not color and variants_list:
                    color = (variants_list[0].get("color") or "").strip()
                if not size and variants_list:
                    size = (variants_list[0].get("size") or "").strip()

                existing = db.query(Product).filter(Product.title.ilike(title)).first()
                if existing:
                    existing.price = price
                    existing.stock = stock
                    if description:
                        existing.description = description
                    if image_url:
                        existing.image = image_url
                    if category_id:
                        existing.categoryId = category_id
                    if color:
                        existing.color = color
                    if size:
                        existing.size = size
                    db.flush()
                    product_id = existing.id
                else:
                    new_prod = Product(
                        id=str(uuid.uuid4()),
                        title=title,
                        description=description,
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

                if images_list:
                    for s_idx, img_item in enumerate(images_list):
                        u = img_item.get("url")
                        if u:
                            p_img = ProductImage(
                                id=str(uuid.uuid4()),
                                productId=product_id,
                                url=u,
                                color=img_item.get("color", "") or "",
                                sortOrder=s_idx,
                            )
                            db.add(p_img)

                if variants_list:
                    for variant in variants_list:
                        v_color = (variant.get("color") or "").strip()
                        v_size = (variant.get("size") or "").strip()
                        try:
                            v_qty = max(0, int(variant.get("qty", 0) or 0))
                        except Exception:
                            v_qty = 0
                        if not v_color and not v_size:
                            continue
                        spec = db.query(Specification).filter_by(
                            productId=product_id,
                            color=v_color,
                            size=v_size,
                        ).first()
                        if spec:
                            spec.qty = v_qty
                        else:
                            spec = Specification(
                                id=str(uuid.uuid4()),
                                productId=product_id,
                                color=v_color,
                                size=v_size,
                                qty=v_qty,
                            )
                            db.add(spec)
                elif color or size:
                    spec = db.query(Specification).filter_by(
                        productId=product_id,
                        color=color,
                        size=size,
                    ).first()
                    if spec:
                        spec.qty += stock
                    else:
                        spec = Specification(
                            id=str(uuid.uuid4()),
                            productId=product_id,
                            color=color,
                            size=size,
                            qty=stock,
                        )
                        db.add(spec)

                db.commit()
                results.append({"index": idx, "title": title, "id": product_id, "success": True})
                success_count += 1

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
