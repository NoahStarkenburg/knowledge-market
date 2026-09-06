import { test, expect } from "@playwright/test";

test.describe("API Health checks", () => {
  test("GET /health returns Healthy", async ({ request }) => {
    const resp = await request.get("http://localhost:5116/health");
    expect(resp.status()).toBe(200);
    expect(await resp.text()).toContain("Healthy");
  });

  test("GET /health/ready returns Healthy with sqlserver check", async ({ request }) => {
    const resp = await request.get("http://localhost:5116/health/ready");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe("Healthy");
    expect(body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "sqlserver", status: "Healthy" }),
      ])
    );
  });
});
