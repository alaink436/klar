import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let wiseInVault = true;
vi.mock("./vault", () => ({
  listSecrets: async () => (wiseInVault ? [{ id: "v-wise", base_url: "https://api.wise.com", revoked_at: null }] : []),
  getForProxy: async () => ({ baseUrl: "https://api.wise.com", key: "wise-token", authHeader: "Authorization", authScheme: "Bearer", authIn: "header" }),
}));

import { approvePayout, owed, saveWiseDetails } from "./payouts";

const NOW = Date.parse("2026-12-03T10:00:00Z");

describe("owed", () => {
  it("adds up closed months only and takes off what was paid, failed payouts not", () => {
    const sums = owed(
      [
        { creator_id: "a", month: "2026-10-01", payable_cents: 1800 },
        { creator_id: "a", month: "2026-11-01", payable_cents: 1500 },
        { creator_id: "a", month: "2026-12-01", payable_cents: 900 }, // running month
        { creator_id: "b", month: "2026-11-01", payable_cents: 1200 },
      ],
      [
        { creator_id: "a", amount_cents: 1000, status: "sent" },
        { creator_id: "a", amount_cents: 3300, status: "failed" },
      ],
      "2026-12-01",
    );
    expect(sums.get("a")).toEqual({ earned: 3300, paid: 1000, through: "2026-11-01" });
    expect(sums.get("b")).toEqual({ earned: 1200, paid: 0, through: "2026-11-01" });
  });
});

describe("approvePayout", () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  let account: Record<string, unknown>;
  let earnings: Array<Record<string, unknown>>;
  let wiseFails = false;
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    calls.length = 0;
    wiseInVault = true;
    wiseFails = false;
    account = { id: "c1", tiktok_handle: "lisa", wise_email: "lisa@example.com", wise_name: "Lisa Muster", wise_recipient_id: null };
    earnings = [
      { creator_id: "c1", month: "2026-10-01", payable_cents: 1800 },
      { creator_id: "c1", month: "2026-11-01", payable_cents: 1500 },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
        if (url.startsWith("https://api.wise.com")) {
          if (url.endsWith("/v2/profiles")) return json([{ id: 11, type: "PERSONAL" }, { id: 22, type: "BUSINESS" }]);
          if (url.endsWith("/v1/accounts")) return wiseFails ? json({ errors: [{ code: "NOT_VALID" }] }, 422) : json({ id: 555 });
          if (url.includes("/quotes")) return json({ id: "quote-uuid" });
          if (url.endsWith("/v1/transfers")) return json({ id: 9001, status: "incoming_payment_waiting" });
        }
        if (method === "PATCH") return new Response(null, { status: 204 });
        if (method === "POST" && url.includes("klar_payouts")) return json([{ id: "p-uuid" }], 201);
        if (url.includes("klar_creator_earnings")) return json(earnings);
        if (url.includes("klar_payouts")) return json([]);
        if (url.includes("klar_creator_accounts")) return json([account]);
        return json([]);
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("creates recipient, quote and transfer for everything owed, in USD from CHF", async () => {
    const r = await approvePayout("c1", NOW);
    expect(r).toEqual({ ok: true, msg: "@lisa: $33.00 als Überweisung in Wise angelegt. Jetzt in der Wise-App bezahlen." });
    const wise = calls.filter((c) => c.url.startsWith("https://api.wise.com"));
    expect(wise.map((c) => c.url.replace("https://api.wise.com", ""))).toEqual(["/v2/profiles", "/v1/accounts", "/v3/profiles/22/quotes", "/v1/transfers"]);
    expect(wise[1].body).toEqual({ profile: 22, accountHolderName: "Lisa Muster", currency: "USD", type: "email", details: { email: "lisa@example.com" } });
    expect(wise[2].body).toEqual({ sourceCurrency: "CHF", targetCurrency: "USD", targetAmount: 33, targetAccount: 555 });
    expect(wise[3].body).toMatchObject({ targetAccount: 555, quoteUuid: "quote-uuid", customerTransactionId: "p-uuid" });
    const inserted = calls.find((c) => c.method === "POST" && c.url.includes("klar_payouts"))!;
    expect(inserted.body).toEqual({ creator_id: "c1", handle: "lisa", amount_cents: 3300, through_month: "2026-11-01" });
    const patches = calls.filter((c) => c.method === "PATCH").map((c) => c.body);
    expect(patches).toEqual([{ wise_recipient_id: 555 }, { status: "sent", wise_transfer_id: 9001 }]);
  });

  it("reuses the recipient Wise already knows", async () => {
    account.wise_recipient_id = 777;
    await approvePayout("c1", NOW);
    expect(calls.some((c) => c.url.endsWith("/v1/accounts"))).toBe(false);
    expect(calls.find((c) => c.url.endsWith("/v1/transfers"))!.body).toMatchObject({ targetAccount: 777 });
  });

  it("marks the payout failed when Wise refuses, so the amount is owed again", async () => {
    wiseFails = true;
    const r = await approvePayout("c1", NOW);
    expect(r.ok).toBe(false);
    expect(r.msg).toContain("Wise hat abgelehnt");
    expect(calls.filter((c) => c.method === "PATCH").at(-1)!.body).toMatchObject({ status: "failed", error: expect.stringContaining("Wise 422") });
  });

  it("refuses under 25 USD, without Wise details, for test accounts and without the Wise key", async () => {
    earnings = [{ creator_id: "c1", month: "2026-11-01", payable_cents: 2499 }];
    expect((await approvePayout("c1", NOW)).msg).toContain("unter 25 USD");
    earnings = [{ creator_id: "c1", month: "2026-11-01", payable_cents: 2500 }];
    account.wise_email = null;
    expect((await approvePayout("c1", NOW)).msg).toContain("keine Wise-Daten");
    account.wise_email = "lisa@example.com";
    account.tiktok_handle = "klar_test_model";
    expect((await approvePayout("c1", NOW)).msg).toBe("Für diesen Creator ist nichts offen.");
    account.tiktok_handle = "lisa";
    wiseInVault = false;
    expect((await approvePayout("c1", NOW)).msg).toContain("Kein Wise-Schlüssel");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});

describe("saveWiseDetails", () => {
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stores a clean email and name and drops the old recipient", async () => {
    expect(await saveWiseDetails("c1", " Lisa@Example.com ", "  Lisa   Muster ")).toBe(true);
    const [, init] = (globalThis.fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({ wise_email: "lisa@example.com", wise_name: "Lisa Muster", wise_recipient_id: null });
  });

  it("refuses what is not an email or not a name", async () => {
    expect(await saveWiseDetails("c1", "lisa", "Lisa Muster")).toBe(false);
    expect(await saveWiseDetails("c1", "lisa@example.com", "L")).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
