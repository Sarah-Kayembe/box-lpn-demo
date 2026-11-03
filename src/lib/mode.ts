/** "mock" uses the sample data in mock-data.ts. "live" talks to ScanPower. */
export const MODE: "mock" | "live" =
  process.env.NEXT_PUBLIC_BOXTAG_MODE === "live" ? "live" : "mock";

export const IS_DEMO = MODE === "mock";
