import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe("chat smoke", () => {
  test.skip(!email || !password, "E2E_USER_EMAIL and E2E_USER_PASSWORD are required");

  test("login, send a message, and render streamed reply", async ({ page }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

    await page.route(`${apiUrl}/generate`, async (route) => {
      const sse =
        'data: {"type":"chunk","text":"Fairness outweighs "}\n\n' +
        'data: {"type":"chunk","text":"because it gates access."}\n\n' +
        'data: {"type":"done","model_tier":"premium","monthly_usage":1,"premium_monthly_limit":30,"notice":null}\n\n';
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: sse,
      });
    });

    await page.route(`${apiUrl}/conversations/**`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":"ok"}' });
        return;
      }
      await route.continue();
    });

    await page.route(`${apiUrl}/generate-title`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ title: "Fairness debate" }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("**/chat**");
    await expect(page.getByPlaceholder("Ask a debate question...")).toBeVisible();

    const prompt = "Why does fairness outweigh education?";
    const input = page.getByPlaceholder("Ask a debate question...");
    await input.fill(prompt);
    await input.press("Enter");

    await expect(page.getByText("Fairness outweighs because it gates access.")).toBeVisible({
      timeout: 15_000,
    });
  });
});
