import { describe, expect, it } from "vitest";

import {
  COOKIE_CONSENT,
  analyticsStorageConsent,
  canUseAnalytics,
  createConsentPreference,
  discardQueuedEvents,
  getConsentStatus,
  injectQueuedEvents,
  queueAnalyticsEvent,
  readConsentPreference,
  shouldShowConsentBanner,
} from "./cookie-consent";

describe("cookie consent preference", () => {
  it("treats missing consent as pending", () => {
    expect(getConsentStatus(null, Date.UTC(2026, 0, 1))).toBe("pending");
    expect(shouldShowConsentBanner(null, Date.UTC(2026, 0, 1))).toBe(true);
    expect(canUseAnalytics(null, Date.UTC(2026, 0, 1))).toBe(false);
  });

  it("stores accepted consent for 6 months", () => {
    const now = Date.UTC(2026, 0, 1);
    const preference = createConsentPreference("accepted", now);

    expect(preference.status).toBe("accepted");
    expect(preference.expiresAt).toBe(now + COOKIE_CONSENT.maxAgeMs);
    expect(getConsentStatus(JSON.stringify(preference), now)).toBe("accepted");
    expect(canUseAnalytics(JSON.stringify(preference), now)).toBe(true);
  });

  it("stores rejected consent for 6 months and blocks analytics", () => {
    const now = Date.UTC(2026, 0, 1);
    const preference = createConsentPreference("rejected", now);

    expect(getConsentStatus(JSON.stringify(preference), now)).toBe("rejected");
    expect(canUseAnalytics(JSON.stringify(preference), now)).toBe(false);
    expect(shouldShowConsentBanner(JSON.stringify(preference), now)).toBe(false);
  });

  it("treats expired or malformed consent as pending", () => {
    const now = Date.UTC(2026, 6, 1);
    const expired = JSON.stringify({ status: "accepted", expiresAt: Date.UTC(2026, 0, 1) });

    expect(readConsentPreference(expired, now)).toBeNull();
    expect(getConsentStatus(expired, now)).toBe("pending");
    expect(getConsentStatus("not-json", now)).toBe("pending");
  });
});

describe("analytics event queue", () => {
  it("maps consent status to GTM analytics storage consent", () => {
    expect(analyticsStorageConsent("accepted")).toBe("granted");
    expect(analyticsStorageConsent("rejected")).toBe("denied");
    expect(analyticsStorageConsent("pending")).toBe("denied");
  });

  it("queues captured analytics events locally before consent", () => {
    const queue = queueAnalyticsEvent([], { event: "page_view", page_path: "/shows/" });

    expect(queue).toEqual([{ event: "page_view", page_path: "/shows/" }]);
  });

  it("discards queued events when consent is denied", () => {
    const queue = [{ event: "page_view", page_path: "/" }];

    expect(discardQueuedEvents(queue)).toEqual([]);
  });

  it("injects queued events into dataLayer in order and clears queue", () => {
    const queuedEvents = [
      { event: "page_view", page_path: "/" },
      { event: "cta_click", cta_label: "listen now" },
    ];
    const dataLayer: unknown[] = [
      ["consent", "default", { analytics_storage: "denied" }],
    ];

    const remainingQueue = injectQueuedEvents(queuedEvents, dataLayer);

    expect(dataLayer).toEqual([
      ["consent", "default", { analytics_storage: "denied" }],
      { event: "page_view", page_path: "/" },
      { event: "cta_click", cta_label: "listen now" },
    ]);
    expect(remainingQueue).toEqual([]);
  });
});
