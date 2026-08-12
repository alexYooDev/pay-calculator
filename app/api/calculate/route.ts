import { NextResponse } from "next/server";
import { calculatePay } from "@/lib/calculate-pay";
import type { RateTemplate, ShiftEntry } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as { shifts: ShiftEntry[]; rateTemplates: RateTemplate[] };

  try {
    const result = await calculatePay(body.shifts, body.rateTemplates);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
