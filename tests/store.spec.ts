import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Public store — no auth. We rely on text/roles and the product anchor
// structure (each tile has an <a href="/shop/<id>"> overlay link).
// ---------------------------------------------------------------------------
const SEL = {
  shopHeading: { role: "heading", name: "Shop" },
  // Tiles wrap a full-bleed Link to the detail page; this anchor is the tile.
  productTileLink: 'a[href^="/shop/"]',
  // A price is rendered as "$NN.NN" text inside each tile and on detail pages.
  priceText: /\$\d+\.\d{2}/,
  addToCartButton: { name: "Add to Cart" },
  addedToCartButton: { name: /added to cart/i },
  cartHeading: { role: "heading", name: "Your Cart" },
  checkoutButton: { name: /checkout with stripe/i },
} as const;

/** Wait for the shop grid to finish its client-side fetch and render tiles. */
async function gotoShopWithProducts(page: Page) {
  await page.goto("/shop");
  await page.waitForLoadState("networkidle");
  const tiles = page.locator(SEL.productTileLink);
  await expect(tiles.first()).toBeVisible();
  return tiles;
}

test.describe("Store · shop listing", () => {
  test("shop displays product tiles, each with a price @smoke", async ({ page }) => {
    const tiles = await gotoShopWithProducts(page);

    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Each tile must show a price. The price lives in the tile's card body,
    // which is the parent container of the overlay anchor.
    for (let i = 0; i < count; i++) {
      const card = tiles.nth(i).locator("xpath=..");
      await expect(card.getByText(SEL.priceText).first()).toBeVisible();
    }
  });
});

test.describe("Store · product detail", () => {
  test("clicking a tile opens the product detail page @smoke", async ({ page }) => {
    const tiles = await gotoShopWithProducts(page);
    await tiles.first().click();

    // URL moves to /shop/<id>.
    await page.waitForURL(/\/shop\/[^/]+$/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    // Title (h1), a price, and the Add to Cart button must all be visible.
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toBeVisible();
    expect((await title.textContent())?.trim().length ?? 0).toBeGreaterThan(0);

    await expect(page.getByText(SEL.priceText).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: SEL.addToCartButton.name })
    ).toBeVisible();
  });
});

test.describe("Store · cart & checkout", () => {
  test("add to cart then reach checkout without crashing @smoke", async ({ page }) => {
    const tiles = await gotoShopWithProducts(page);
    await tiles.first().click();
    await page.waitForURL(/\/shop\/[^/]+$/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    // Add the item from the detail page.
    const addButton = page.getByRole("button", { name: SEL.addToCartButton.name });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Confirm the add registered. The detail button flips to "Added to Cart",
    // but the page can also re-run its load effect and bounce back to /shop
    // (where the tile button shows "Added") — both indicate success. The header
    // cart count is the most stable confirmation across either outcome.
    await expect(page.getByRole("link", { name: /\d+\s*cart/i })).toBeVisible();

    // Cart is persisted in localStorage, so it survives navigation in-context.
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: SEL.cartHeading.name })
    ).toBeVisible();

    // At least one line item (each cart row shows a price).
    await expect(page.getByText(SEL.priceText).first()).toBeVisible();

    // Checkout button present.
    const checkout = page.getByRole("button", { name: SEL.checkoutButton.name });
    await expect(checkout).toBeVisible();

    // Click checkout. This POSTs /api/checkout/session; on success the app does
    // window.location.href = <Stripe URL> (external nav). On failure it shows an
    // inline error. Either way the page must NOT crash — we assert the page is
    // still responsive afterward (a body element is present and queryable).
    await checkout.click();

    // Give the click a beat to either start an external redirect or surface an
    // inline error. We then confirm the page is still alive and one of the two
    // graceful outcomes occurred.
    await page
      .waitForURL(/checkout\.stripe\.com|stripe\.com/, { timeout: 8_000 })
      .catch(() => {
        /* no external redirect — fall through to inline-state checks */
      });

    const onStripe = /stripe\.com/.test(page.url());
    if (onStripe) {
      // External Stripe redirect began — success path, nothing crashed.
      expect(onStripe).toBe(true);
    } else {
      // Stayed on the cart: page is still rendered and responsive. Either an
      // inline error is shown or the button reverted — both are graceful.
      await expect(page.locator("body")).toBeVisible();
      const stillOnCart =
        (await page
          .getByRole("heading", { name: SEL.cartHeading.name })
          .isVisible()
          .catch(() => false)) ||
        (await page.getByText(/checkout/i).first().isVisible().catch(() => false));
      expect(stillOnCart).toBe(true);
    }
  });
});
