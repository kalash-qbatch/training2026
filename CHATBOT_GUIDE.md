# ShopBuddy: E-Commerce Chatbot Architecture & Documentation

## Overview

**ShopBuddy** is a production-ready, anti-hallucinatory conversational shopping assistant designed for the online store. It provides customer guidance, natural-language product search with dynamic filter extraction, product comparisons, store policy lookup, and an end-to-end decoupled **Add to Cart** action.

---

## 1. Grounding & Anti-Hallucination Guarantees

1. **Tool-Derived Facts Only**: Every product fact (name, price, stock, ratings, specifications) originates exclusively from deterministic tool execution on verified catalog data.
2. **Zero Fictional Items**: If a query yields 0 results (e.g., non-existent items like "flying teleporters"), the engine truthfully discloses that no items were found and suggests broadening the search.
3. **Out-of-Stock Handling**: When an item has `stock <= 0`, it is visibly tagged as **Out of stock**, the "Add to Cart" button is **disabled**, and in-stock alternatives from the catalog are automatically surfaced.
4. **Policy Safeguards**: Inquiries regarding shipping, return windows, warranties, and payments are strictly answered from `store-policies.json`. The chatbot will never invent promo codes, delivery promises, or refunds outside official policy.
5. **Prompt Injection & Jailbreak Defense**: Common injection attempts (`"ignore previous instructions"`, `"reveal system prompt"`, `"DAN mode"`) are intercepted and neutralized immediately.

---

## 2. Architecture & Request Pipeline

```
┌────────────────────────────────────────────────────────┐
│             Customer (Widget / API Client)            │
└───────────────────────────┬────────────────────────────┘
                            │ POST /api/store-assistant
                            ▼
┌────────────────────────────────────────────────────────┐
│  1. Security Layer                                     │
│     - Input Sanitization (strip HTML/XSS, clamp <=500) │
│     - Prompt Injection Detector                        │
│     - Sliding Window Rate Limiter (20 req/min/session) │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  2. Intent Classifier                                  │
│     - small_talk       ──> Friendly greeting & steer   │
│     - out_of_scope     ──> Polite store refusal        │
│     - unclear          ──> Single clarifying question  │
│     - order_policy     ──> get_store_policies          │
│     - cart_action      ──> view_cart / remove_from_cart│
│     - compare_products ──> compare_products            │
│     - product_detail   ──> get_product                 │
│     - product_search   ──> search_products             │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  3. Tool Dispatcher & Execution Engine                 │
│     - Strict Zod schema validation on all inputs       │
│     - Stop-word filtering & singular/plural stemming   │
│     - Anti-hallucination verification                  │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  4. Zod Response Validation & Repair                   │
│     - Validates against ChatbotResponseSchema          │
│     - Retries / auto-repairs structure once            │
│     - Fallback safe error message on failure           │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  5. Client Delivery (JSON Format)                      │
│     { "message": "...", "type": "...", "products": [] }│
└────────────────────────────────────────────────────────┘
```

---

## 3. Direct Fast "Add to Cart" Pipeline

To ensure high speed, zero hallucination, and instantaneous UI response, clicking **"Add to Cart"** does **NOT** pass through an LLM prompt. Instead:

1. The frontend widget calls `POST /api/store-assistant/cart` directly.
2. The endpoint validates stock and inventory limits, updating the customer session cart.
3. The widget simultaneously updates the website's Zustand `useCartStore`, causing the Navbar shopping bag badge to update immediately.
4. Loading spinner, debouncing against double clicks, and a success toast notification are provided automatically.

---

## 4. API Endpoints

### `POST /api/store-assistant`

Main conversational endpoint.

- **Request Body**:
  ```json
  {
    "message": "Show me watches under $160",
    "sessionId": "user_session_123",
    "history": []
  }
  ```
- **Response Format**:
  ```json
  {
    "message": "Found 3 item(s) matching your request. Here are our top recommendations:",
    "type": "products",
    "products": [
      {
        "id": "prod-008",
        "name": "Minimalist Sapphire Stainless Watch",
        "price": 150.0,
        "currency": "USD",
        "image": "/products/watch.jpg",
        "rating": 4.9,
        "in_stock": true,
        "short_description": "Sleek 40mm quartz timepiece with scratch-resistant sapphire crystal...",
        "actions": [
          {
            "label": "Add to Cart",
            "action": "add_to_cart",
            "payload": { "product_id": "prod-008", "quantity": 1 },
            "disabled": false
          },
          {
            "label": "View Details",
            "action": "view_product",
            "payload": { "product_id": "prod-008" }
          }
        ]
      }
    ],
    "quick_replies": ["Details on Minimalist Sapph", "View Cart"]
  }
  ```

### `POST /api/store-assistant/cart`

Direct add-to-cart endpoint.

- **Request Body**: `{ "productId": "prod-001", "quantity": 1 }`
- **Response**: `{ "success": true, "message": "Added item to cart", "cart": { ... } }`

### `GET /api/store-assistant/cart`

Retrieves the session cart summary.

### `DELETE /api/store-assistant/cart`

Removes an item from the session cart.

---

## 5. Configuration & Environment Variables

Key variables in `.env`:

```ini
# Groq API Key (Fast, high-throughput LLM tool calling)
GROQ_API_KEY=gsk_...

# Alternative LLM Provider (Optional)
OPENAI_API_KEY=sk-...

# Database Connection (Neon PostgreSQL)
DATABASE_URL=postgresql://...
```

Store configuration can be customized in [config.ts](file:///Users/qbatch/Desktop/next_app_fullstack/lib/chatbot/config.ts):

- `STORE_NAME`: Store branding displayed by the assistant
- `MAX_RECOMMENDED_PRODUCTS`: Maximum product cards per turn (default: `5`)
- `SESSION_RATE_LIMIT_MAX`: Requests allowed per window (default: `20` per min)
- `MAX_MESSAGE_INPUT_LENGTH`: Input character clamp (default: `500`)

---

## 6. Running Automated Tests

Run the full chatbot test suite:

```bash
npm test -- __tests__/chatbot
```

Test suites executed:

1. `__tests__/chatbot/40-conversations.test.ts` (43 conversation turns)
2. `__tests__/chatbot/tools.test.ts` (Search, get product, cart, policy tools)
3. `__tests__/chatbot/security.test.ts` (Sanitization, injection defense, rate limiting)
4. `__tests__/chatbot/schema-validation.test.ts` (Zod schema adherence & repairs)
5. `__tests__/chatbot/direct-cart.test.ts` (Direct fast Add-to-Cart end-to-end)

**Result**: 5 Passed, 0 Failed (76 total tests passing).
