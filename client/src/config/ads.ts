/**
 * CBdrop Monetization & Ads Configuration
 * 
 * To start earning ad revenue:
 * 1. Sign up for a free publisher account on Monetag (https://monetag.com) or Adsterra (https://adsterra.com).
 * 2. Get your Zone ID or Banner Script snippet.
 * 3. Paste your credentials below and set `networkAdsEnabled: true`.
 * 
 * Free users will see the ads.
 * Pro users (subscribers) will NEVER see any ads.
 */

export interface AdConfiguration {
  /** If true, third-party network ads are loaded for free users */
  networkAdsEnabled: boolean;

  /** Which ad network to load: 'monetag' | 'adsterra' | 'custom' */
  provider: "monetag" | "adsterra" | "custom";

  /** Monetag Zone ID (e.g. "1234567") */
  monetagZoneId?: string;

  /** Adsterra Direct / Banner script URL */
  adsterraScriptUrl?: string;

  /** Custom HTML snippet from your ad network */
  customHtml?: string;

  /** High-paying affiliate link (e.g. NordVPN, Surfshark, or CapCut) shown when network ads are not active */
  affiliateBanner: {
    title: string;
    description: string;
    badge: string;
    ctaText: string;
    url: string;
  };

  /** Lemon Squeezy or Stripe Checkout link for CBdrop Pro */
  checkoutUrls: {
    monthly: string;
    yearly: string;
  };
}

export const adConfig: AdConfiguration = {
  // Set to true once you paste your real Monetag or Adsterra Zone ID
  networkAdsEnabled: false,

  provider: "monetag",
  monetagZoneId: "", // Paste your Monetag Zone ID here
  adsterraScriptUrl: "", // Or paste your Adsterra script URL here

  // High-converting default sponsor card (Earns $20-$40 per conversion)
  affiliateBanner: {
    title: "Download at 10x Speed with Total Privacy",
    description: "Bypass geo-restrictions, hide your IP, and save videos without ISP throttling.",
    badge: "74% OFF + 3 MO FREE",
    ctaText: "Get Surfshark VPN",
    url: "https://surfshark.com", // Replace with your affiliate referral link
  },

  // Lemon Squeezy / Stripe Pro Checkout URLs
  checkoutUrls: {
    monthly: "https://cbdrop.lemonsqueezy.com/buy/monthly-pro", // Replace with your checkout link
    yearly: "https://cbdrop.lemonsqueezy.com/buy/yearly-pro",
  },
};
