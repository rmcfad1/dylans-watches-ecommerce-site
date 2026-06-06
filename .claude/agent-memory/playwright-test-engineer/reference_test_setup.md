---
name: reference-test-setup
description: Playwright suite layout, auth reuse pattern, and known app race conditions
metadata:
  type: reference
---

# Playwright suite setup for Dylan's Watches

Config at `/Users/bryan/dylans-watches-ecommerce-site/playwright.config.ts`. Tests in `tests/`. Two projects: `admin` (testMatch admin.spec.ts, uses saved storageState) and `store` (store.spec.ts, no auth). baseURL is production: `https://dylans-watches-ecommerce-site.vercel.app`.

Auth reuse: `tests/global-setup.ts` logs in via the real `/login` form (server action sets an httpOnly `admin-session` cookie) and saves `storageState` to `tests/.auth/admin.json`. The admin project loads that file so admin tests skip re-login. The login *flow* test itself runs in a fresh unauthenticated context via `test.use({ storageState: { cookies: [], origins: [] } })`.

WARNING: `tests/.auth/admin.json` contains a live admin session cookie — never commit it. (Repo currently has no .gitignore.)

Known app race condition — product detail page (`/shop/[id]`): its load `useEffect` re-fetches and redirects back to `/shop` if the item isn't shop-enabled/available. After clicking "Add to Cart" on the detail page, the page can bounce to `/shop` before the "Added to Cart" button state is observable. Do NOT assert on the detail button's post-click text; assert the header cart-count link instead (it's stable across both the stay-on-detail and bounce-to-shop outcomes).

Checkout test is intentionally tolerant: clicking checkout either begins an external Stripe redirect (`stripe.com`) or shows an inline error — the test only asserts the page didn't crash, never that Stripe actually loads.

Run with `npx playwright test`. Chromium-only; browser installed via `npx playwright install chromium`.

Related: [[reference-selectors]]
