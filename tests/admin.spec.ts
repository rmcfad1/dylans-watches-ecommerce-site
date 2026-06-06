import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Credentials (admin login is gated by an httpOnly cookie set by a server
// action — we log in via the UI form, never by setting cookies directly).
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = "bryan@mainstreetaiconsultants.com";
const ADMIN_PASSWORD = "UR45a!-vAf4!9-MSgr82!";

// ---------------------------------------------------------------------------
// Stable selectors. We rely on text/roles/labels rather than Tailwind classes.
// ---------------------------------------------------------------------------
const SEL = {
  // Login labels lack for/id association, so target inputs by form field name.
  emailField: 'input[name="username"]',
  passwordField: 'input[name="password"]',
  signInButton: { role: "button", name: "Sign in" },
  dashboardHeading: { role: "heading", name: "Dashboard" },
  // The 4th dashboard card is "Total Profit" in the live app (not "Revenue").
  statCardLabels: ["Total Items", "Active Listings", "Total Orders", "Total Profit"],
  statCardHrefs: ["/inventory", "/listings", "/orders", "/orders"],
  inventoryHeading: { role: "heading", name: "Inventory" },
  generatorHeading: { role: "heading", name: "AI Listing Generator" },
  generateButton: { role: "button", name: "Generate Listing" },
} as const;

test.describe("Admin · authentication", () => {
  // This test must exercise the real login flow, so it runs in a fresh,
  // unauthenticated context rather than the reused admin storageState.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("logs in and redirects to the dashboard @smoke", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.locator(SEL.emailField).fill(ADMIN_EMAIL);
    await page.locator(SEL.passwordField).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: SEL.signInButton.name }).click();

    // Successful login redirects to the dashboard at "/".
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: SEL.dashboardHeading.name })
    ).toBeVisible();
  });
});

test.describe("Admin · dashboard", () => {
  // These tests reuse the authenticated session from global-setup (configured
  // on the "admin" project's storageState in playwright.config.ts).
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: SEL.dashboardHeading.name })
    ).toBeVisible();
  });

  test("renders the four stat cards, each clickable with non-empty value @smoke", async ({
    page,
  }) => {
    for (let i = 0; i < SEL.statCardLabels.length; i++) {
      const label = SEL.statCardLabels[i];
      const href = SEL.statCardHrefs[i];

      // Each card is an <a> (Next Link) wrapping the label text.
      const cardLink = page.locator(`a[href="${href}"]`, { hasText: label });
      await expect(cardLink).toBeVisible();

      // Clickable === has a usable href to a real admin route.
      await expect(cardLink).toHaveAttribute("href", href);

      // The value sits just above the label inside the card. It defaults to "—"
      // until the stats API resolves; a soft assertion lets a zero value (e.g.
      // "0" or "$0.00") still pass while flagging a literal "—" placeholder.
      const value = cardLink.locator("p").first();
      await expect(value).toBeVisible();
      const valueText = (await value.textContent())?.trim() ?? "";
      expect.soft(valueText, `${label} value should not be the "—" placeholder`).not.toBe("—");
      expect(valueText.length).toBeGreaterThan(0);
    }
  });
});

test.describe("Admin · inventory", () => {
  test("inventory list renders a heading and at least one row @smoke", async ({
    page,
  }) => {
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: SEL.inventoryHeading.name })
    ).toBeVisible();

    // The list is fetched client-side; wait for a data row to appear. Empty
    // state renders a single row with a colspan cell saying "No items found",
    // so we assert on a real item row (a row containing a link to /inventory/<id>).
    const itemRow = page.locator("tbody tr", {
      has: page.locator('a[href^="/inventory/"]'),
    });
    await expect(itemRow.first()).toBeVisible();
    expect(await itemRow.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Admin · AI generator", () => {
  test("generator form renders without submitting @smoke", async ({ page }) => {
    await page.goto("/generate");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: SEL.generatorHeading.name })
    ).toBeVisible();

    // The "Item" text input. Its <label> isn't associated (no for/id), so we
    // target it by its placeholder text instead.
    const itemInput = page.getByPlaceholder(/Apple Watch Series/i);
    await expect(itemInput).toBeVisible();
    await expect(itemInput).toBeEditable();

    // Generate button exists. It is disabled until "Item" has text — we only
    // assert presence and never click it (no API calls per the spec).
    await expect(
      page.getByRole("button", { name: SEL.generateButton.name })
    ).toBeVisible();
  });
});
