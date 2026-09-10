import unittest
from unittest.mock import patch

from app.tasks.email_tasks import render_invoice_email, send_email_task


class InvoiceEmailTemplateTests(unittest.TestCase):
    def setUp(self):
        self.payload = {
            "order_id": "a1b2c3d4-e5f6-4789-a012-3456789abcde",
            "order_number": "a1b2c3d4-e5f6-4789-a012-3456789abcde",
            "name": "Jane & Co",
            "payment_method": "CARD",
            "payment_status": "SUCCEEDED",
            "order_status": "PROCESSING",
            "subtotal": "59.98",
            "tax": "4.80",
            "total": "64.78",
            "order_url": "/orders/a1b2c3d4-e5f6-4789-a012-3456789abcde?from=email&view=receipt",
            "items": [
                {
                    "title": "Classic <Tee>",
                    "image_url": "/products/tee.jpg",
                    "quantity": 2,
                    "unit_price": "29.99",
                    "line_total": "59.98",
                    "color": "Black",
                    "size": "M",
                }
            ],
            "shipping": {
                "fullName": "Jane Doe",
                "phone": "+1 555 0100",
                "address": "12 Market Street",
                "city": "New York",
                "postalCode": "10001",
            },
        }

    def test_renders_products_images_variants_and_price_summary(self):
        subject, html, text = render_invoice_email(
            self.payload,
            app_base_url="https://shop.example.com",
        )

        self.assertEqual(
            subject,
            "Order Confirmed a1b2c3d4-e5f6-4789-a012-3456789abcde — Bhai ka Store",
        )
        self.assertIn("https://shop.example.com/products/tee.jpg", html)
        self.assertIn("Classic &lt;Tee&gt;", html)
        self.assertNotIn("Classic <Tee>", html)
        self.assertIn("Color: Black", html)
        self.assertIn("Size: M", html)
        self.assertIn("Qty 2 &times; $29.99", html)
        self.assertIn("$59.98", html)
        self.assertIn("$4.80", html)
        self.assertIn("$64.78", html)
        self.assertIn("12 Market Street, New York, 10001", html)
        self.assertIn(
            "https://shop.example.com/orders/a1b2c3d4-e5f6-4789-a012-3456789abcde?from=email&amp;view=receipt",
            html,
        )
        self.assertIn("Classic <Tee> (Color: Black, Size: M)", text)
        self.assertIn("Order total: $64.78", text)

    def test_remains_useful_for_older_jobs_without_item_details(self):
        _, html, text = render_invoice_email(
            {
                "order_id": "b2c3d4e5-e5f6-4789-a012-3456789abcde",
                "order_number": "b2c3d4e5-e5f6-4789-a012-3456789abcde",
                "total": "20",
            },
            app_base_url="https://shop.example.com",
        )

        self.assertIn("Product details are available in your order history.", html)
        self.assertIn("$20.00", html)
        self.assertIn("Product details are available in your order history.", text)

    @patch("app.tasks.email_tasks.send_smtp_email")
    def test_invoice_task_sends_html_and_plain_text_versions(self, send_smtp_email):
        result = send_email_task.run("invoice", "jane@example.com", self.payload)

        self.assertEqual(result["status"], "sent")
        send_smtp_email.assert_called_once()
        message = send_smtp_email.call_args.kwargs
        self.assertEqual(message["to_email"], "jane@example.com")
        self.assertIn("<img src=", message["html_content"])
        self.assertIn("ITEMS", message["text_content"])


if __name__ == "__main__":
    unittest.main()
