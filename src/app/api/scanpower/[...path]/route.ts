import { NextRequest, NextResponse } from "next/server";

/*
 * Server-side proxy to the ScanPower API, used in live mode only.
 * Credentials stay on the server. GET /v3/auth (Basic auth) returns a bearer
 * token, which is cached until shortly before it expires.
 *
 * Env: SCANPOWER_BASE_URL (default https://beta.scanpower.com/api),
 *      SCANPOWER_USERNAME, SCANPOWER_PASSWORD
 */

const BASE = process.env.SCANPOWER_BASE_URL ?? "https://beta.scanpower.com/api";
const ALLOWED = [/^v3\/inventory$/, /^v3\/location$/, /^v3\/pack-template$/, /^v3\/az-shipment$/, /^v3\/az-box(\/items)?$/];

let token: { value: string; expiresAt: number } | null = null;

async function getToken() {
  if (token && Date.now() < token.expiresAt) return token.value;
  const user = process.env.SCANPOWER_USERNAME;
  const pass = process.env.SCANPOWER_PASSWORD;
  if (!user || !pass) throw new Error("SCANPOWER_USERNAME and SCANPOWER_PASSWORD are not set");

  const res = await fetch(`${BASE}/v3/auth`, {
    headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` },
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(body?.errors?.[0]?.message ?? `Auth failed with status ${res.status}`);
  }
  const lifetime = Number(body.expires_in ?? 3600) * 1000;
  token = { value: body.access_token, expiresAt: Date.now() + lifetime - 60_000 };
  return token.value;
}

async function forward(req: NextRequest, path: string[]) {
  if (process.env.NEXT_PUBLIC_BOXTAG_MODE !== "live") {
    return NextResponse.json({ errors: [{ message: "Live mode is off" }] }, { status: 404 });
  }
  const joined = path.join("/");
  if (!ALLOWED.some((rule) => rule.test(joined))) {
    return NextResponse.json({ errors: [{ message: "Path not allowed" }] }, { status: 403 });
  }

  try {
    const url = `${BASE}/${joined}${req.nextUrl.search}`;
    const res = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
      body: req.method === "GET" ? undefined : await req.text(),
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { errors: [{ message: error instanceof Error ? error.message : "Request failed" }] },
      { status: 502 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
