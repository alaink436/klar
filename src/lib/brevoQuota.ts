// Brevo daily-quota fetcher for the outreach-Daily-Cap-Card on /admin?view=outreach.
//
// Free plan = 300 transactional emails/day, reset 00:00 UTC. The 300-cap is
// not exposed via API on free tier, so we hardcode it as fallback and use
// /v3/smtp/statistics/aggregatedReport for today's delivered + requests count.
//
// 60s cache so a refreshed /admin tab does not pound the Brevo API.

const BREVO_API = "https://api.brevo.com/v3";
const DAILY_CAP_FALLBACK = 300; // free-plan transactional limit

export type BrevoQuotaState =
  | { state: "ok"; usedToday: number; capDaily: number; fetchedAt: string; planName?: string }
  | { state: "no-key" }
  | { state: "http-error"; status: number; bodySnippet: string }
  | { state: "exception"; message: string };

interface BrevoAggregated {
  requests?: number;
  delivered?: number;
  hardBounces?: number;
  softBounces?: number;
  blocked?: number;
}

interface BrevoAccount {
  plan?: Array<{ type?: string; creditsType?: string; credits?: number }>;
}

async function fetchBrevoToday(apiKey: string): Promise<{ used: number; planName?: string }> {
  // Brevo date format: YYYY-MM-DD in UTC. Use today's UTC date.
  const today = new Date().toISOString().slice(0, 10);
  const url = `${BREVO_API}/smtp/statistics/aggregatedReport?startDate=${today}&endDate=${today}`;

  const [aggRes, accRes] = await Promise.all([
    fetch(url, {
      headers: { "api-key": apiKey, accept: "application/json" },
      next: { revalidate: 60 },
    }),
    fetch(`${BREVO_API}/account`, {
      headers: { "api-key": apiKey, accept: "application/json" },
      next: { revalidate: 300 },
    }),
  ]);

  if (!aggRes.ok) {
    const text = await aggRes.text().catch(() => "");
    throw new Error(`Brevo agg HTTP ${aggRes.status}: ${text.slice(0, 120)}`);
  }
  const agg = (await aggRes.json()) as BrevoAggregated;
  // "requests" = emails accepted (counts against the daily cap), regardless of
  // delivery status. Free-tier 300/day counts requested, not delivered.
  const used = Number(agg.requests ?? 0);

  let planName: string | undefined;
  if (accRes.ok) {
    const acc = (await accRes.json()) as BrevoAccount;
    const transactional = acc.plan?.find(
      (p) => p.type === "free" || p.creditsType === "sendLimit" || p.type === "subscription",
    );
    if (transactional?.type === "free") planName = "Free (300/day)";
    else if (transactional?.type === "subscription") planName = `${transactional.creditsType ?? "Subscription"}`;
  }

  return { used, planName };
}

export async function getBrevoQuota(): Promise<BrevoQuotaState> {
  const key = process.env.BREVO_API_KEY ?? process.env.KLAR_BREVO_API_KEY ?? "";
  if (!key) return { state: "no-key" };

  try {
    const { used, planName } = await fetchBrevoToday(key);
    return {
      state: "ok",
      usedToday: used,
      capDaily: DAILY_CAP_FALLBACK,
      planName,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("Brevo agg HTTP ")) {
      // Pull status out of "HTTP <num>:"
      const m = msg.match(/HTTP (\d+):\s*(.*)$/);
      const status = m ? Number(m[1]) : 0;
      const bodySnippet = m ? m[2].slice(0, 160) : msg.slice(0, 160);
      return { state: "http-error", status, bodySnippet };
    }
    return { state: "exception", message: msg.slice(0, 160) };
  }
}
