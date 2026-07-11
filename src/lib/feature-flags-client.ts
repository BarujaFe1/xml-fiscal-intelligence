/**
 * Client-safe flag mirrors — only NEXT_PUBLIC_* / known safe defaults.
 * Never put secrets here.
 */
export function getFeatureFlags(): Record<string, boolean> {
  return {
    ai: process.env.NEXT_PUBLIC_ENABLE_AI === "true",
    billingReady: process.env.NEXT_PUBLIC_BILLING_READY === "true",
    localProcessing: true,
    cloudProcessing: false,
  };
}
