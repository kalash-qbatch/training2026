from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from html import escape
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import urljoin, urlparse

from app.celery_app import celery_app
from app.config import settings

BASE_STYLE = """
<style>
  body{margin:0;padding:0;background:#eef1f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{padding:40px 16px}
  .card{max-width:640px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08)}
  .hdr{padding:36px 32px 28px;text-align:center}
  .logo{font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.9;margin:0 0 12px;font-weight:600}
  .hdr h1{margin:0 0 6px;font-size:24px;font-weight:700;letter-spacing:-.02em}
  .hdr p{margin:0;font-size:14px;opacity:.9;line-height:1.45}
  .bdy{padding:28px 32px 32px}
  .greet{color:#1f2937;font-size:15px;margin:0 0 10px;line-height:1.5}
  .copy{color:#6b7280;font-size:14px;margin:0 0 18px;line-height:1.6}
  .bdg{display:inline-block;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.02em}
  .tbl{background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:6px 18px;margin:0 0 18px}
  .row{display:table;width:100%;padding:12px 0;border-bottom:1px solid #eef2f7;font-size:14px}
  .row:last-child{border-bottom:none}
  .lbl{display:table-cell;width:50%;color:#6b7280;padding-right:16px;vertical-align:middle;text-align:left}
  .val{display:table-cell;width:50%;font-weight:650;color:#111827;text-align:right;vertical-align:middle}
  .ibox{border-radius:12px;padding:14px 16px;margin:0 0 8px;font-size:13px;line-height:1.55}
  .btn{display:block;text-align:center;text-decoration:none;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:700;margin-top:18px}
  .ftr{padding:18px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #f1f5f9;line-height:1.5}
  @media only screen and (max-width:620px){.wrap{padding:16px 8px}.hdr{padding:28px 20px 24px}.bdy{padding:22px 18px 26px}.ftr{padding:16px 18px}}
</style>"""


def _shell(hdr_bg: str, title: str, subtitle: str, body: str) -> str:
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{BASE_STYLE}</head>
<body><div class="wrap"><div class="card">
  <div class="hdr" style="background:{hdr_bg};color:#fff">
    <p class="logo">Bhai ka Store</p>
    <h1>{title}</h1>
    <p>{subtitle}</p>
  </div>
  <div class="bdy">{body}</div>
  <div class="ftr">Bhai ka Store &bull; Questions? <a href="mailto:support@bhaikastore.com" style="color:#2563eb;text-decoration:underline">support@bhaikastore.com</a></div>
</div></div></body></html>"""


def _money(value, default="0.00") -> str:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        amount = Decimal(default).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{amount:,.2f}"


def _quantity(value) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return 1


def _public_url(value, base_url: str) -> str:
    if not value:
        return ""
    absolute = urljoin(f"{base_url.rstrip('/')}/", str(value))
    parsed = urlparse(absolute)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return ""
    return absolute


def _invoice_items(payload: dict, base_url: str):
    raw_items = payload.get("items")
    if not isinstance(raw_items, list):
        return []

    items = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        quantity = _quantity(raw_item.get("quantity", raw_item.get("qty", 1)))
        unit_price = _money(raw_item.get("unit_price", raw_item.get("price", 0)))
        calculated_total = Decimal(unit_price.replace(",", "")) * quantity
        items.append(
            {
                "title": str(raw_item.get("title") or "Product"),
                "image_url": _public_url(
                    raw_item.get("image_url", raw_item.get("imageUrl")),
                    base_url,
                ),
                "quantity": quantity,
                "unit_price": unit_price,
                "line_total": _money(raw_item.get("line_total", calculated_total)),
                "color": str(raw_item.get("color") or ""),
                "size": str(raw_item.get("size") or ""),
            }
        )
    return items


def _invoice_items_html(items: list[dict]) -> str:
    if not items:
        return """<div style="padding:18px;border:1px dashed #dbe3ee;border-radius:12px;color:#64748b;font-size:13px;text-align:center">
          Product details are available in your order history.
        </div>"""

    rows = []
    for item in items:
        title = escape(item["title"])
        image_url = escape(item["image_url"], quote=True)
        variant_parts = []
        if item["color"]:
            variant_parts.append(f"Color: {escape(item['color'])}")
        if item["size"]:
            variant_parts.append(f"Size: {escape(item['size'])}")
        variant = " &nbsp;&bull;&nbsp; ".join(variant_parts)
        variant_html = (
            f'<div style="margin-top:4px;color:#64748b;font-size:12px;line-height:18px">{variant}</div>'
            if variant
            else ""
        )
        image_html = (
            f'<img src="{image_url}" width="76" height="76" alt="{title}" '
            'style="display:block;width:76px;height:76px;border:0;border-radius:10px;object-fit:cover;background:#f1f5f9">'
            if item["image_url"]
            else '<div style="width:76px;height:76px;border-radius:10px;background:#eef2f7;text-align:center;line-height:76px;font-size:24px;color:#94a3b8">&#128717;</div>'
        )
        rows.append(
            f"""
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 10px;border:1px solid #e7edf4;border-radius:13px;background:#ffffff">
              <tr>
                <td width="92" valign="middle" style="padding:12px 0 12px 12px">{image_html}</td>
                <td valign="middle" style="padding:12px;min-width:0">
                  <div style="color:#172033;font-size:14px;font-weight:700;line-height:20px">{title}</div>
                  {variant_html}
                  <div style="margin-top:6px;color:#64748b;font-size:12px;line-height:18px">Qty {item['quantity']} &times; ${item['unit_price']}</div>
                </td>
                <td width="82" valign="middle" align="right" style="padding:12px 14px 12px 4px;color:#172033;font-size:14px;font-weight:700;white-space:nowrap">${item['line_total']}</td>
              </tr>
            </table>"""
        )
    return "".join(rows)


def render_invoice_email(payload: dict, app_base_url: str | None = None):
    base_url = app_base_url or settings.APP_BASE_URL
    items = _invoice_items(payload, base_url)
    order_number_text = str(payload.get("order_id") or payload.get("order_number") or "—")
    order_number = escape(order_number_text)
    name_text = str(payload.get("name") or "Customer")
    name = escape(name_text)
    payment_method = str(payload.get("payment_method") or "CARD").upper()
    payment_status = str(payload.get("payment_status") or "PENDING").upper()
    order_status = str(payload.get("order_status") or "PROCESSING").upper()
    method_label = "Cash on Delivery" if payment_method == "COD" else "Credit / Debit Card"

    item_subtotal = sum(
        Decimal(item["line_total"].replace(",", "")) for item in items
    )
    subtotal = _money(payload.get("subtotal", item_subtotal))
    tax = _money(payload.get("tax", 0))
    total = _money(payload.get("total", Decimal(subtotal.replace(",", "")) + Decimal(tax.replace(",", ""))))
    unit_count = sum(item["quantity"] for item in items)

    pay_badge = (
        '<span class="bdg" style="background:#dcfce7;color:#15803d">Paid</span>'
        if payment_status in ("PAID", "SUCCEEDED")
        else '<span class="bdg" style="background:#fef3c7;color:#92400e">Unpaid</span>'
        if payment_status in ("UNPAID", "FAILED", "PENDING")
        else f'<span class="bdg" style="background:#e0e7ff;color:#3730a3">{escape(payment_status.title())}</span>'
    )
    order_badge = (
        '<span class="bdg" style="background:#dbeafe;color:#1d4ed8">Processing</span>'
        if order_status == "PROCESSING"
        else '<span class="bdg" style="background:#fef3c7;color:#92400e">Pending</span>'
        if order_status == "PENDING"
        else f'<span class="bdg" style="background:#e5e7eb;color:#374151">{escape(order_status.title())}</span>'
    )

    shipping = payload.get("shipping") if isinstance(payload.get("shipping"), dict) else {}
    shipping_name_text = str(
        shipping.get("fullName") or shipping.get("full_name") or name_text
    )
    shipping_name = escape(shipping_name_text)
    shipping_phone = escape(str(shipping.get("phone") or ""))
    address_parts = [
        shipping.get("address"),
        shipping.get("city"),
        shipping.get("postalCode", shipping.get("postal_code")),
    ]
    shipping_address = ", ".join(escape(str(part)) for part in address_parts if part)
    shipping_html = ""
    if shipping_address or shipping_phone:
        shipping_html = f"""
          <div style="margin-top:22px;color:#172033;font-size:14px;font-weight:700">Delivery details</div>
          <div style="margin-top:9px;padding:15px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e7edf4;color:#475569;font-size:13px;line-height:20px">
            <strong style="color:#172033">{shipping_name}</strong><br>
            {shipping_address}{'<br>' if shipping_address and shipping_phone else ''}{shipping_phone}
          </div>"""

    order_url = _public_url(payload.get("order_url"), base_url)
    escaped_order_url = escape(order_url, quote=True)
    button_html = (
        f'<a href="{escaped_order_url}" class="btn" style="background:#0f766e;color:#ffffff">View Your Order</a>'
        if order_url
        else ""
    )
    items_label = f"{unit_count} item{'s' if unit_count != 1 else ''}" if items else "Order items"

    body = f"""
      <p class="greet">Hi <strong>{name}</strong>, your order is confirmed.</p>
      <p class="copy">We have received your order and will keep you updated as it moves forward.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 22px;border:1px solid #e7edf4;border-radius:12px;background:#f8fafc">
        <tr><td style="padding:14px 16px;border-bottom:1px solid #e7edf4;color:#64748b;font-size:13px">Order ID</td><td align="right" style="padding:14px 16px;border-bottom:1px solid #e7edf4;color:#172033;font-size:14px;font-weight:700">{order_number}</td></tr>
        <tr><td style="padding:14px 16px;border-bottom:1px solid #e7edf4;color:#64748b;font-size:13px">Payment method</td><td align="right" style="padding:14px 16px;border-bottom:1px solid #e7edf4;color:#172033;font-size:13px;font-weight:700">{method_label}</td></tr>
        <tr><td style="padding:14px 16px;border-bottom:1px solid #e7edf4;color:#64748b;font-size:13px">Payment status</td><td align="right" style="padding:10px 16px;border-bottom:1px solid #e7edf4">{pay_badge}</td></tr>
        <tr><td style="padding:14px 16px;color:#64748b;font-size:13px">Order status</td><td align="right" style="padding:10px 16px">{order_badge}</td></tr>
      </table>

      <div style="margin:0 0 10px;color:#172033;font-size:14px;font-weight:700">{items_label}</div>
      {_invoice_items_html(items)}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin-top:18px;border-radius:13px;background:#f0fdfa;border:1px solid #ccfbf1">
        <tr><td style="padding:14px 18px 7px;color:#64748b;font-size:13px">Subtotal</td><td align="right" style="padding:14px 18px 7px;color:#334155;font-size:13px;font-weight:600">${subtotal}</td></tr>
        <tr><td style="padding:7px 18px 14px;color:#64748b;font-size:13px">Tax</td><td align="right" style="padding:7px 18px 14px;color:#334155;font-size:13px;font-weight:600">${tax}</td></tr>
        <tr><td style="padding:15px 18px;border-top:1px solid #99f6e4;color:#0f766e;font-size:15px;font-weight:800">Order total</td><td align="right" style="padding:15px 18px;border-top:1px solid #99f6e4;color:#0f766e;font-size:19px;font-weight:800">${total}</td></tr>
      </table>
      {shipping_html}
      {button_html}
      <p style="margin:18px 0 0;color:#94a3b8;font-size:11px;line-height:17px;text-align:center">Keep this email for your records. If you have questions, reply to this message with your order ID.</p>
    """

    subject = payload.get("subject") or f"Invoice & Order Confirmed {order_number_text} — Bhai ka Store"
    html = _shell(
        "linear-gradient(135deg,#059669,#0f766e)",
        "Invoice & Order Confirmed!",
        f"Order {order_number} &bull; Thanks for shopping with us",
        body,
    )

    text_lines = [
        "INVOICE & ORDER CONFIRMED",
        f"Order {order_number_text}",
        f"Customer: {name_text}",
        f"Payment method: {method_label}",
        f"Payment status: {payment_status.title()}",
        f"Order status: {order_status.title()}",
        "",
        "ITEMS",
    ]
    if items:
        for item in items:
            variants = ", ".join(
                part
                for part in (
                    f"Color: {item['color']}" if item["color"] else "",
                    f"Size: {item['size']}" if item["size"] else "",
                )
                if part
            )
            variant_text = f" ({variants})" if variants else ""
            text_lines.append(
                f"- {item['title']}{variant_text}: {item['quantity']} x ${item['unit_price']} = ${item['line_total']}"
            )
    else:
        text_lines.append("Product details are available in your order history.")
    text_lines.extend(
        [
            "",
            f"Subtotal: ${subtotal}",
            f"Tax: ${tax}",
            f"Order total: ${total}",
        ]
    )
    if shipping_address or shipping_phone:
        text_lines.extend(
            [
                "",
                "DELIVERY DETAILS",
                shipping_name_text,
                ", ".join(str(part) for part in address_parts if part),
                str(shipping.get("phone") or ""),
            ]
        )
    if order_url:
        text_lines.extend(["", f"View your order: {order_url}"])

    return str(subject), html, "\n".join(line for line in text_lines if line is not None)


def send_smtp_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Bhai ka Store <{settings.EMAIL_SENDER}>"
    msg["To"] = to_email

    if text_content:
        msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    print(f"[email_task] Connecting SMTP {settings.SMTP_HOST}:{settings.SMTP_PORT} → {to_email}")
    if settings.SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        server.starttls()

    try:
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_SENDER, [to_email], msg.as_string())
        print(f"[email_task] Sent: '{subject}' → {to_email}")
    except Exception as e:
        print(f"[email_task] Error: {e}")
        raise e
    finally:
        try:
            server.quit()
        except Exception:
            pass


@celery_app.task(bind=True, name="app.tasks.email_tasks.send_email_task")
def send_email_task(self, email_type: str, to: str, payload: dict):
    """
    Supported email_type values:
      forgot_password  - reset password link
      invoice          - order confirmation (COD or Card)
      payment_failed   - payment declined, order still PENDING / UNPAID
      payment_success  - card payment confirmed
      order_approved   - admin approved order (SHIPPED)
      order_delivered  - admin marked order as DELIVERED
      order_cancelled  - order cancelled (auto-cancel or admin)
    """
    subject = payload.get("subject", "")
    html = payload.get("html", "")
    text = payload.get("text", "")

    if email_type == "forgot_password":
        reset_url = escape(str(payload.get("reset_url", "#")), quote=True)
        name = escape(str(payload.get("name", "there")))
        subject = subject or "Reset your password — Bhai ka Store"
        if not html:
            html = _shell(
                "linear-gradient(135deg,#1d4ed8,#4338ca)",
                "Reset Password",
                "We received a password reset request",
                f"""
                <p class="greet">Dear <strong>{name}</strong>,</p>
                <p class="copy">Click the button below to choose a new password. This link expires in 1 hour.</p>
                <a href="{reset_url}" class="btn" style="background:#2563eb;color:#fff">Reset My Password</a>
                <div class="ibox" style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;margin-top:18px">
                  If you did not request this, you can safely ignore this email.</div>
                """,
            )

    elif email_type == "invoice":
        if not html:
            rendered_subject, html, rendered_text = render_invoice_email(payload)
            subject = subject or rendered_subject
            text = text or rendered_text
        else:
            order_number = payload.get("order_number") or "—"
            subject = subject or f"Invoice & Order Confirmed {order_number} — Bhai ka Store"

    elif email_type == "payment_failed":
        order_id = str(payload.get("order_id") or payload.get("order_number") or "")
        order_number = escape(order_id or "—")
        name = escape(str(payload.get("name") or "Customer"))
        total = payload.get("total", "")
        attempt = int(payload.get("attempt", 1))
        cancel_minutes = int(payload.get("cancel_minutes", 5))
        retry_url = escape(
            str(payload.get("retry_url") or f"{settings.APP_BASE_URL}/orders/{order_id}"),
            quote=True,
        )
        total_row = (
            f'<div class="row"><span class="lbl">Amount Due</span>'
            f'<span class="val" style="color:#b45309;font-size:16px">${escape(str(total))}</span></div>'
            if total
            else ""
        )
        subject = subject or f"Payment Unpaid — Order {payload.get('order_id') or payload.get('order_number')} is Pending"
        if not html:
            html = _shell(
                "linear-gradient(135deg,#d97706,#b45309)",
                "Payment Unpaid",
                "Your order is pending — please complete payment",
                f"""
                <p class="greet">Dear <strong>{name}</strong>,</p>
                <p class="copy">We could not process your payment. Your order is still reserved with
                <strong>Payment Status: Unpaid</strong> and <strong>Order Status: Pending</strong>.</p>
                <div class="tbl">
                  <div class="row"><span class="lbl">Order ID</span><span class="val">{order_number}</span></div>
                  {total_row}
                  <div class="row"><span class="lbl">Payment Status</span><span class="val">
                    <span class="bdg" style="background:#fee2e2;color:#991b1b">Unpaid</span></span></div>
                  <div class="row"><span class="lbl">Order Status</span><span class="val">
                    <span class="bdg" style="background:#fef3c7;color:#92400e">Pending</span></span></div>
                  <div class="row"><span class="lbl">Attempt</span><span class="val">#{attempt}</span></div>
                </div>
                <div class="ibox" style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412">
                  Please retry payment within <strong>{cancel_minutes} minutes</strong>.
                  If payment is not completed in time, this order will be <strong>automatically cancelled</strong>
                  and reserved stock will be released.</div>
                <a href="{retry_url}" class="btn" style="background:#d97706;color:#fff">Check Order Details</a>
                """,
            )

    elif email_type == "payment_success":
        order_number = escape(str(payload.get("order_id") or payload.get("order_number") or "—"))
        total = escape(str(payload.get("total") or "0.00"))
        name = escape(str(payload.get("name") or "Customer"))
        subject = subject or f"Payment Confirmed — Order {payload.get('order_id') or payload.get('order_number')}"
        if not html:
            html = _shell(
                "linear-gradient(135deg,#2563eb,#4f46e5)",
                "Payment Confirmed!",
                "Your card payment was successful",
                f"""
                <p class="greet">Dear <strong>{name}</strong>, your payment was successfully processed.</p>
                <div class="tbl">
                  <div class="row"><span class="lbl">Order ID</span><span class="val">{order_number}</span></div>
                  <div class="row"><span class="lbl">Total Charged</span><span class="val" style="color:#2563eb;font-size:16px">${total}</span></div>
                  <div class="row"><span class="lbl">Payment Status</span><span class="val">
                    <span class="bdg" style="background:#dcfce7;color:#15803d">Paid</span></span></div>
                  <div class="row"><span class="lbl">Order Status</span><span class="val">
                    <span class="bdg" style="background:#dbeafe;color:#1d4ed8">Processing</span></span></div>
                </div>
                """,
            )

    elif email_type == "order_approved":
        order_number = escape(str(payload.get("order_id") or payload.get("order_number") or "—"))
        name = escape(str(payload.get("name") or "Customer"))
        total = escape(str(payload.get("total") or "0.00"))
        subject = subject or f"Order {payload.get('order_id') or payload.get('order_number')} Approved — On the way!"
        if not html:
            html = _shell(
                "linear-gradient(135deg,#2563eb,#1d4ed8)",
                "Order Approved!",
                "Your order has been approved and is being prepared",
                f"""
                <p class="greet">Dear <strong>{name}</strong>,</p>
                <p class="copy">Good news — your order has been <strong>approved</strong> and is now being prepared for delivery.</p>
                <div class="tbl">
                  <div class="row"><span class="lbl">Order ID</span><span class="val">{order_number}</span></div>
                  <div class="row"><span class="lbl">Total</span><span class="val">${total}</span></div>
                  <div class="row"><span class="lbl">Order Status</span><span class="val">
                    <span class="bdg" style="background:#dbeafe;color:#1d4ed8">Approved</span></span></div>
                </div>
                <div class="ibox" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a">
                  We will notify you again once your order has been delivered.</div>
                """,
            )

    elif email_type == "order_delivered":
        order_number = escape(str(payload.get("order_id") or payload.get("order_number") or "—"))
        name = escape(str(payload.get("name") or "Customer"))
        total = escape(str(payload.get("total") or "0.00"))
        subject = subject or f"Your Order {payload.get('order_id') or payload.get('order_number')} has been Delivered!"
        if not html:
            html = _shell(
                "linear-gradient(135deg,#16a34a,#059669)",
                "Order Delivered!",
                "Your package has arrived",
                f"""
                <p class="greet">Dear <strong>{name}</strong>, your order has been delivered.</p>
                <div class="tbl">
                  <div class="row"><span class="lbl">Order ID</span><span class="val">{order_number}</span></div>
                  <div class="row"><span class="lbl">Total</span><span class="val">${total}</span></div>
                  <div class="row"><span class="lbl">Order Status</span><span class="val">
                    <span class="bdg" style="background:#dcfce7;color:#15803d">Delivered</span></span></div>
                  <div class="row"><span class="lbl">Payment Status</span><span class="val">
                    <span class="bdg" style="background:#dcfce7;color:#15803d">Paid</span></span></div>
                </div>
                <div class="ibox" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534">
                  Enjoying your order? We would love your feedback!</div>
                """,
            )

    elif email_type == "order_cancelled":
        order_number = escape(str(payload.get("order_id") or payload.get("order_number") or "—"))
        name = escape(str(payload.get("name") or "Customer"))
        reason = escape(
            str(
                payload.get(
                    "reason",
                    "payment was not completed in time",
                )
            )
        )
        subject = subject or f"Order {payload.get('order_id') or payload.get('order_number')} has been Cancelled"
        if not html:
            html = _shell(
                "linear-gradient(135deg,#ef4444,#dc2626)",
                "Order Cancelled",
                "This order could not be completed",
                f"""
                <p class="greet">Dear <strong>{name}</strong>,</p>
                <p class="copy">Your order <strong>{order_number}</strong> has been cancelled because {reason}.</p>
                <div class="tbl">
                  <div class="row"><span class="lbl">Order ID</span><span class="val">{order_number}</span></div>
                  <div class="row"><span class="lbl">Order Status</span><span class="val">
                    <span class="bdg" style="background:#fee2e2;color:#991b1b">Cancelled</span></span></div>
                  <div class="row"><span class="lbl">Payment Status</span><span class="val">
                    <span class="bdg" style="background:#fee2e2;color:#991b1b">Unpaid</span></span></div>
                </div>
                <div class="ibox" style="background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d">
                  Reserved stock has been released back to the store. You can reorder anytime from your order history.</div>
                """,
            )

    else:
        raise ValueError(f"Unknown email_type: {email_type}")

    try:
        send_smtp_email(to_email=to, subject=subject, html_content=html, text_content=text)
        return {"status": "sent", "to": to, "type": email_type}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=10, max_retries=3)
