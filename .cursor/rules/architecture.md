### Folder structure
Use App Router under `app/(auth)` and `app/(main)` per IMPLEMENTATION_PLAN.
- Shared UI: `components/ui`
- Feature UI: `components/features/{auth,cart,orders,products}`
- Layout: `components/layout` (Navbar, Footer)
- Zod: `lib/validations`
- Utils: `lib/utils.ts`
- Mock client data (until APIs land): `lib/api`, `lib/store`
- API route stubs: `app/api/...`
Absolute imports via `@/`.

### Conventions
- Forms: react-hook-form + zodResolver, inline field errors, top-level errors via toast
- Protect main routes with AuthGuard (client redirect to /login) until Auth.js middleware is wired
- Persist auth + cart with zustand persist
- formatCurrency / formatDate via lib/utils — no scattered toFixed
- No `any`
