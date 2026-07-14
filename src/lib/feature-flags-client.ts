/**
 * Client-safe flag mirrors — only NEXT_PUBLIC_* / known safe defaults.
 * Never put secrets here. AI feature removed from product.
 */
export function getFeatureFlags(): Record<string, boolean> {
  return {
    billingReady: process.env.NEXT_PUBLIC_BILLING_READY === "true",
    localProcessing: true,
    cloudProcessing: process.env.NEXT_PUBLIC_FEATURE_CLOUD_PROCESSING === "true",
  };
}
