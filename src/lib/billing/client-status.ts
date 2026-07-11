/** Client-visible billing readiness — no secrets. */
export function billingIsLiveClient(): boolean {
  return process.env.NEXT_PUBLIC_BILLING_READY === "true";
}
