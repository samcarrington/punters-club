export const COOKIE_CONSENT = {
  storageKey: "puntersClub.cookieConsent.v1",
  queueKey: "puntersClub.analyticsQueue.v1",
  maxAgeMs: 1000 * 60 * 60 * 24 * 183,
} as const;

export type ConsentStatus = "accepted" | "rejected" | "pending";
export type StoredConsentStatus = Exclude<ConsentStatus, "pending">;

export type ConsentPreference = {
  status: StoredConsentStatus;
  expiresAt: number;
};

export type AnalyticsEvent = {
  event: string;
  [key: string]: unknown;
};

export type GtmConsentValue = "granted" | "denied";

export function createConsentPreference(
  status: StoredConsentStatus,
  now = Date.now(),
): ConsentPreference {
  return {
    status,
    expiresAt: now + COOKIE_CONSENT.maxAgeMs,
  };
}

export function readConsentPreference(
  value: string | null,
  now = Date.now(),
): ConsentPreference | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ConsentPreference>;

    if (
      (parsed.status === "accepted" || parsed.status === "rejected") &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > now
    ) {
      return parsed as ConsentPreference;
    }
  } catch {
    return null;
  }

  return null;
}

export function getConsentStatus(
  value: string | null,
  now = Date.now(),
): ConsentStatus {
  return readConsentPreference(value, now)?.status ?? "pending";
}

export function shouldShowConsentBanner(
  value: string | null,
  now = Date.now(),
): boolean {
  return getConsentStatus(value, now) === "pending";
}

export function canUseAnalytics(value: string | null, now = Date.now()): boolean {
  return getConsentStatus(value, now) === "accepted";
}

export function analyticsStorageConsent(
  status: ConsentStatus | StoredConsentStatus,
): GtmConsentValue {
  return status === "accepted" ? "granted" : "denied";
}

export function queueAnalyticsEvent(
  queue: AnalyticsEvent[],
  event: AnalyticsEvent,
): AnalyticsEvent[] {
  return [...queue, event];
}

export function discardQueuedEvents(_queue: AnalyticsEvent[]): AnalyticsEvent[] {
  return [];
}

export function injectQueuedEvents(
  queue: AnalyticsEvent[],
  dataLayer: unknown[],
): AnalyticsEvent[] {
  for (const event of queue) {
    dataLayer.push(event);
  }

  return [];
}
