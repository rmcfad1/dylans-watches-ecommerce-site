---
name: reference-selectors
description: Non-obvious stable selectors and form-field quirks for Playwright tests in this app
metadata:
  type: reference
---

# Selector knowledge for Dylan's Watches app

Form `<label>` elements in this app are NOT associated with their inputs (no `for`/`id`, no aria-label, no wrapping). So `page.getByLabel(...)` does NOT work for any form here. Confirmed on `/login` and `/generate`.

- Login (`/login`): email field is `input[name="username"]`, password is `input[name="password"]`, submit is `getByRole("button", { name: "Sign in" })`. Successful login is a server action that redirects to `/`; failure redirects to `/login?error=1`.
- Generate (`/generate`): the "Item" input has no usable label — target by placeholder `getByPlaceholder(/Apple Watch Series/i)`. The "Generate Listing" button is disabled until Item has text.

Dashboard (`/`): the 4 stat cards are `Total Items`, `Active Listings`, `Total Orders`, and **`Total Profit`** (NOT "Revenue" — task specs sometimes say Revenue, but the live card is Total Profit). Each card is a Next `<Link>` rendered as `<a href="...">` → hrefs are `/inventory`, `/listings`, `/orders`, `/orders`. Stat values default to the literal `"—"` until `/api/inventory?stats=1` resolves.

Inventory (`/inventory`): client-fetched table. Empty state is a single `<tr>` with a colspan cell. A real data row contains `a[href^="/inventory/"]` — assert on that to avoid matching the empty-state row.

Shop (`/shop`): each product tile is `a[href^="/shop/"]` (a full-bleed overlay Link). Price renders as `$NN.NN` text. Data comes from `/api/inventory?shop=1`.

Cart: client-side only, persisted in `localStorage` under key `dylans-watches-cart` (see `src/lib/cart.tsx`). Survives in-context navigation. Header cart link reads like `"1 Cart"` → `getByRole("link", { name: /\d+\s*cart/i })` is the most stable add-to-cart confirmation. Checkout button text is "Checkout with Stripe →"; it POSTs `/api/checkout/session` then `window.location.href = data.url` (external Stripe redirect).

Related: [[reference-test-setup]]
