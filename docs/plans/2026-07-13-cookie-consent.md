# Cookie Consent Banner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an analytics-only cookie consent banner that loads GTM through Astro Partytown, denies analytics storage by default, grants `analytics_storage` only after Allow, queues pre-consent events locally, and discards queued events after Deny.

**Architecture:** Keep the feature static and dependency-light. Put consent state, queue logic, and GTM consent helpers in a small tested TypeScript module; configure `@astrojs/partytown` so GTM runs off the main thread; render one Astro banner component from the shared layout; style it with existing tokens and button classes. GTM remains in `PuntersLayout.astro`, but a normal inline Consent Mode default-denied snippet must run before the Partytown GTM loader.

**Tech Stack:** Astro 7, `@astrojs/partytown`, TypeScript, Vitest, Google Tag Manager Consent Mode, browser `localStorage`, existing CSS tokens/buttons.

---

## EARS requirements

| ID | Pattern | Requirement |
| --- | --- | --- |
| CC-001 | Optional-feature | Where the analytics cookie consent banner feature is included, the website shall block analytics cookies until analytics consent is accepted. |
| CC-002 | State-driven | While no stored cookie consent preference exists, the website shall display the cookie consent banner on each page view. |
| CC-003 | Event-driven | When the visitor selects "Accept analytics cookies", the website shall store an accepted cookie consent preference for 6 months. |
| CC-004 | Event-driven | When the visitor selects "Reject analytics cookies", the website shall store a rejected cookie consent preference for 6 months. |
| CC-005 | State-driven | While the stored cookie consent preference is accepted, the website shall permit analytics cookies. |
| CC-006 | State-driven | While the stored cookie consent preference is rejected, the website shall block analytics cookies. |
| CC-007 | Event-driven | When the visitor selects "Change cookie preferences", the website shall display the cookie consent banner. |
| CC-008 | State-driven | While the cookie consent banner is displayed, the website shall provide a keyboard-operable control to accept analytics cookies. |
| CC-009 | State-driven | While the cookie consent banner is displayed, the website shall provide a keyboard-operable control to reject analytics cookies. |
| CC-010 | State-driven | While no stored cookie consent preference exists, the website shall store captured analytics events in a local queue. |
| CC-011 | State-driven | While no stored cookie consent preference exists, the website shall block transmission of queued analytics events. |
| CC-012 | Event-driven | When the visitor selects "Accept analytics cookies", the website shall set the Google Tag Manager `analytics_storage` consent permission to `granted`. |
| CC-013 | Event-driven | When the visitor selects "Accept analytics cookies", the website shall inject queued analytics events into the analytics provider. |
| CC-014 | Complex | While queued analytics events exist, when the visitor selects "Reject analytics cookies", the website shall discard queued analytics events. |
| CC-015 | Unwanted-behavior | If analytics cookie loading fails, then the website shall render the requested page. |
| CC-016 | State-driven | While the cookie consent banner is displayed, the website shall overlay the cookie consent banner above the page content at the bottom edge of the viewport. |
| CC-017 | State-driven | While the cookie consent banner is displayed, the website shall keep the cookie consent banner visible at the bottom edge of the viewport during page scrolling. |
| CC-018 | State-driven | While the cookie consent banner is displayed, the website shall render the cookie consent banner with a single flat background colour without background image, gradient, or texture. |
| CC-019 | State-driven | While the cookie consent banner is displayed, the website shall label the analytics consent acceptance control "Allow". |
| CC-020 | State-driven | While the cookie consent banner is displayed, the website shall label the analytics consent rejection control "Deny". |
| CC-021 | State-driven | While the cookie consent banner is displayed, the website shall render the "Allow" control as the primary button. |
| CC-022 | State-driven | While the cookie consent banner is displayed, the website shall render the "Deny" control as a secondary button. |

## Implementation notes

- GTM is already present in `src/layouts/PuntersLayout.astro`; do not add a second GTM loader.
- Use Astro's official Partytown integration for third-party script loading: https://docs.astro.build/en/guides/integrations-guide/partytown/
- Use the blog pattern as implementation inspiration only, not as an unversioned dependency: https://rafalszymanski.pl/en/blog/cookie-gtm-astro-guide/#step-1-install-partytown-2-minutes
- Run the Consent Mode default-denied snippet as a normal inline head script before GTM; do not mark that default-denied script as `type="text/partytown"`.
- Mark only the GTM loader script as `type="text/partytown"`.
- Remove or disable `@vercel/analytics` rendering because this plan treats GTM/GA as the only analytics path covered by consent.
- If `@vercel/analytics` remains installed, gate its client `inject()` call behind accepted consent as a separate analytics path; GTM consent updates alone do not load or control Vercel Analytics.
- Use `pnpm exec astro build` for UI-only build verification so generated Mixcloud/Spotify/next-show data does not churn.
- Keep copy plain and short. The banner should not feel like a SaaS modal or another rounded card section.

---

### Task 1: Install and configure Astro Partytown

**Files:**
- Modify: `astro.config.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Install the Partytown integration**

Run:

```bash
pnpm add @astrojs/partytown
```

Expected: `package.json` gains `@astrojs/partytown`; `pnpm-lock.yaml` updates. Do not use npm and do not create `package-lock.json`.

**Step 2: Configure Partytown in Astro**

Modify `astro.config.mjs`:

```diff
 import { defineConfig } from "astro/config";
+import partytown from "@astrojs/partytown";
 import icon from "astro-icon";
 
 export default defineConfig({
   srcDir: "./src",
@@
   integrations: [
+    partytown({
+      config: {
+        forward: ["dataLayer.push"],
+      },
+    }),
     icon({
       include: {
         gridicons: ["external"],
```

Use official Astro docs as source of truth for the integration shape: https://docs.astro.build/en/guides/integrations-guide/partytown/

**Step 3: Build to verify integration wiring**

Run:

```bash
pnpm exec astro build
```

Expected: PASS and generated output includes Partytown assets. If Partytown complains about configuration shape, check current Astro docs before changing the pattern.

**Step 4: Commit**

```bash
git add astro.config.mjs package.json pnpm-lock.yaml
git commit -m "feat: add Partytown for GTM"
```

---

### Task 2: Add tested consent state and queue helpers

**Files:**
- Create: `src/lib/cookie-consent.ts`
- Create: `src/lib/cookie-consent.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/cookie-consent.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  COOKIE_CONSENT,
  canUseAnalytics,
  createConsentPreference,
  discardQueuedEvents,
  getConsentStatus,
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
  it("queues captured analytics events locally before consent", () => {
    const queue = queueAnalyticsEvent([], { event: "page_view", page_path: "/shows/" });

    expect(queue).toEqual([{ event: "page_view", page_path: "/shows/" }]);
  });

  it("discards queued events when consent is denied", () => {
    const queue = [{ event: "page_view", page_path: "/" }];

    expect(discardQueuedEvents(queue)).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/lib/cookie-consent.test.ts
```

Expected: FAIL because `src/lib/cookie-consent.ts` does not exist.

**Step 3: Write minimal implementation**

Create `src/lib/cookie-consent.ts`:

```ts
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

export function getConsentStatus(value: string | null, now = Date.now()): ConsentStatus {
  return readConsentPreference(value, now)?.status ?? "pending";
}

export function shouldShowConsentBanner(value: string | null, now = Date.now()): boolean {
  return getConsentStatus(value, now) === "pending";
}

export function canUseAnalytics(value: string | null, now = Date.now()): boolean {
  return getConsentStatus(value, now) === "accepted";
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
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test src/lib/cookie-consent.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/cookie-consent.ts src/lib/cookie-consent.test.ts
git commit -m "feat: add cookie consent state helpers"
```

---

### Task 3: Add GTM consent helpers and queue injection tests

**Files:**
- Modify: `src/lib/cookie-consent.ts`
- Modify: `src/lib/cookie-consent.test.ts`

**Step 1: Write the failing tests**

Append to `src/lib/cookie-consent.test.ts`:

```ts
import { analyticsStorageConsent, injectQueuedEvents } from "./cookie-consent";

describe("GTM consent mode", () => {
  it("maps accepted consent to granted analytics storage", () => {
    expect(analyticsStorageConsent("accepted")).toBe("granted");
  });

  it.each(["pending", "rejected"] as const)(
    "maps %s consent to denied analytics storage",
    (status) => {
      expect(analyticsStorageConsent(status)).toBe("denied");
    },
  );

  it("injects queued analytics events into the dataLayer in order", () => {
    const dataLayer: unknown[] = [];
    const remaining = injectQueuedEvents(
      [
        { event: "page_view", page_path: "/" },
        { event: "show_open", show_slug: "spring-forward" },
      ],
      dataLayer,
    );

    expect(dataLayer).toEqual([
      { event: "page_view", page_path: "/" },
      { event: "show_open", show_slug: "spring-forward" },
    ]);
    expect(remaining).toEqual([]);
  });
});
```

If the duplicate import conflicts with existing imports, merge the new symbols into the first import block.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/lib/cookie-consent.test.ts
```

Expected: FAIL because `analyticsStorageConsent` and `injectQueuedEvents` do not exist.

**Step 3: Write minimal implementation**

Append to `src/lib/cookie-consent.ts`:

```ts
export type GtmConsentValue = "granted" | "denied";

export function analyticsStorageConsent(status: ConsentStatus): GtmConsentValue {
  return status === "accepted" ? "granted" : "denied";
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
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test src/lib/cookie-consent.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/cookie-consent.ts src/lib/cookie-consent.test.ts
git commit -m "feat: add GTM consent queue helpers"
```

---

### Task 4: Render the consent banner component

**Files:**
- Create: `src/components/CookieConsent.astro`
- Modify: `src/layouts/PuntersLayout.astro`

**Step 1: Create the component markup and behavior**

Create `src/components/CookieConsent.astro`:

```astro
---
---

<section
  class="cookie-consent"
  data-cookie-consent
  aria-label="Cookie consent"
  hidden
>
  <div class="cookie-consent__copy">
    <p class="cookie-consent__eyebrow">Cookies</p>
    <p>
      We use analytics cookies to understand listening journeys. Allow them, or deny them and keep browsing.
    </p>
  </div>
  <div class="cookie-consent__actions">
    <button class="btn btn-primary" type="button" data-cookie-consent-allow>Allow</button>
    <button class="btn btn-secondary" type="button" data-cookie-consent-deny>Deny</button>
  </div>
</section>

<button class="cookie-preferences" type="button" data-cookie-consent-change hidden>
  Change cookie preferences
</button>

<script>
  import {
    COOKIE_CONSENT,
    canUseAnalytics,
    createConsentPreference,
    discardQueuedEvents,
    getConsentStatus,
    injectQueuedEvents,
    queueAnalyticsEvent,
    shouldShowConsentBanner,
    type AnalyticsEvent,
  } from "../lib/cookie-consent";

  declare global {
    interface Window {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
      puntersAnalytics?: {
        track: (event: AnalyticsEvent) => void;
      };
    }
  }

  const banner = document.querySelector<HTMLElement>("[data-cookie-consent]");
  const allowButton = document.querySelector<HTMLButtonElement>("[data-cookie-consent-allow]");
  const denyButton = document.querySelector<HTMLButtonElement>("[data-cookie-consent-deny]");
  const changeButton = document.querySelector<HTMLButtonElement>("[data-cookie-consent-change]");

  const readStoredPreference = () => localStorage.getItem(COOKIE_CONSENT.storageKey);
  const readQueue = (): AnalyticsEvent[] => {
    try {
      return JSON.parse(localStorage.getItem(COOKIE_CONSENT.queueKey) ?? "[]") as AnalyticsEvent[];
    } catch {
      return [];
    }
  };
  const writeQueue = (queue: AnalyticsEvent[]) => {
    localStorage.setItem(COOKIE_CONSENT.queueKey, JSON.stringify(queue));
  };
  const setBannerVisible = (visible: boolean) => {
    if (banner) banner.hidden = !visible;
  };

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer?.push(Array.from(arguments)); };

  window.puntersAnalytics = {
    track(event) {
      if (canUseAnalytics(readStoredPreference())) {
        window.dataLayer?.push(event);
        return;
      }

      writeQueue(queueAnalyticsEvent(readQueue(), event));
    },
  };

  const applyPreference = () => {
    const status = getConsentStatus(readStoredPreference());
    window.gtag?.("consent", "update", {
      analytics_storage: status === "accepted" ? "granted" : "denied",
    });
    setBannerVisible(shouldShowConsentBanner(readStoredPreference()));
    if (changeButton) changeButton.hidden = status === "pending";
  };

  allowButton?.addEventListener("click", () => {
    localStorage.setItem(
      COOKIE_CONSENT.storageKey,
      JSON.stringify(createConsentPreference("accepted")),
    );
    window.gtag?.("consent", "update", { analytics_storage: "granted" });
    writeQueue(injectQueuedEvents(readQueue(), window.dataLayer ?? []));
    applyPreference();
  });

  denyButton?.addEventListener("click", () => {
    localStorage.setItem(
      COOKIE_CONSENT.storageKey,
      JSON.stringify(createConsentPreference("rejected")),
    );
    window.gtag?.("consent", "update", { analytics_storage: "denied" });
    writeQueue(discardQueuedEvents(readQueue()));
    applyPreference();
  });

  changeButton?.addEventListener("click", () => setBannerVisible(true));

  applyPreference();
</script>
```

**Step 2: Mount the component in the layout**

Modify `src/layouts/PuntersLayout.astro`:

```diff
 import Analytics from "@vercel/analytics/astro";
 import AppFooter from "../components/AppFooter.astro";
 import AppHeader from "../components/AppHeader.astro";
+import CookieConsent from "../components/CookieConsent.astro";
 import { SITE } from "../lib/constants";
```

Then render it before `</body>`:

```diff
     <AppHeader />
     <main id="top">
       <slot />
     </main>
     <AppFooter />
+    <CookieConsent />
   </body>
```

Do not keep the `Analytics` import/rendering after Task 5.

**Step 3: Run build to catch Astro/script errors**

Run:

```bash
pnpm exec astro build
```

Expected: PASS. If TypeScript complains about `declare global` inside the Astro client script, move the global declarations to `src/env.d.ts` in a later fix step.

**Step 4: Commit**

```bash
git add src/components/CookieConsent.astro src/layouts/PuntersLayout.astro
git commit -m "feat: render cookie consent banner"
```

---

### Task 5: Style the bottom overlay banner

**Files:**
- Modify: `src/styles/global.css`

**Step 1: Add component styles**

Add near the existing `.btn`/component blocks in `src/styles/global.css`:

```css
.cookie-consent {
  position: fixed;
  inset-inline: 0;
  inset-block-end: 0;
  z-index: 50;
  display: grid;
  gap: var(--space-md);
  padding: var(--space-md);
  border-top: var(--rule-thick) solid var(--color-accent);
  background: var(--color-paper-3);
  color: var(--color-ink);
}

.cookie-consent[hidden],
.cookie-preferences[hidden] {
  display: none;
}

.cookie-consent__copy {
  max-width: 64ch;
}

.cookie-consent__copy p {
  margin: 0;
}

.cookie-consent__eyebrow {
  color: var(--color-accent);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.cookie-consent__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.cookie-preferences {
  position: fixed;
  inset-inline-end: var(--space-md);
  inset-block-end: var(--space-md);
  z-index: 40;
  border: var(--rule-thin) solid var(--color-rule);
  border-radius: 999px;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-paper-3);
  color: var(--color-ink-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--text-xs);
}

.cookie-preferences:focus-visible {
  outline: var(--rule-thick) solid var(--color-focus);
  outline-offset: var(--space-2xs);
}

@media (min-width: 720px) {
  .cookie-consent {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding-inline: max(var(--space-md), calc(50vw - var(--content-half-width)));
  }
}
```

This satisfies flat colour by using a single `background` colour and no gradient/image/texture.

**Step 2: Build**

Run:

```bash
pnpm exec astro build
```

Expected: PASS.

**Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "style: add cookie consent overlay"
```

---

### Task 6: Set GTM Consent Mode defaults before Partytown GTM loads

**Files:**
- Modify: `src/layouts/PuntersLayout.astro`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Remove Vercel Analytics rendering**

In `src/layouts/PuntersLayout.astro`, remove:

```diff
-import Analytics from "@vercel/analytics/astro";
```

And remove:

```diff
-    <Analytics />
```

Then remove the dependency:

```bash
pnpm remove @vercel/analytics
```

Expected: `package.json` and `pnpm-lock.yaml` update. Do not reintroduce `package-lock.json`.

**Step 2: Add default denied consent before GTM loader**

In `src/layouts/PuntersLayout.astro`, add this immediately before the existing `<!-- Google Tag Manager -->` block:

```astro
    <script is:inline>
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag(){window.dataLayer.push(Array.from(arguments));};
      gtag('consent', 'default', {
        analytics_storage: 'denied'
      });
    </script>
```

The default-denied consent script must stay as a normal inline script so it runs before GTM. It must not use `type="text/partytown"`.

**Step 3: Move the existing GTM loader into Partytown**

In the existing GTM loader script, add `type="text/partytown"`:

```diff
-    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
+    <script type="text/partytown">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
```

Keep the existing `GTM-MSSM6ZK7` ID and the existing noscript iframe. Do not add another GTM loader.

This follows Astro's official Partytown pattern for third-party scripts and the referenced GTM/cookie guide pattern. If GTM requests fail in the worker due to CORS during browser smoke testing, add a follow-up task to configure Partytown `resolveUrl`/proxying rather than blocking this first implementation by default.

**Step 4: Build**

Run:

```bash
pnpm exec astro build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/layouts/PuntersLayout.astro package.json pnpm-lock.yaml
git commit -m "feat: default GTM analytics consent to denied"
```

---

### Task 7: Browser smoke test consent behavior

**Files:**
- No source changes expected unless smoke test finds a bug.

**Step 1: Start dev server**

Run:

```bash
pnpm run dev
```

Expected: Astro dev server starts.

**Step 2: Verify first visit pending state**

In browser DevTools:

1. Clear site data for the dev origin.
2. Load `/`.
3. Confirm the banner appears at the bottom and overlays content.
4. Confirm the banner remains visible while scrolling.
5. Confirm buttons read `Allow` and `Deny`.
6. Confirm `Allow` uses `.btn-primary`; `Deny` uses `.btn-secondary`.
7. Confirm the GTM loader script has `type="text/partytown"` in the Elements panel.
8. Confirm this console expression returns no queued transmission:

```js
window.dataLayer.filter((item) => item && item.analytics_storage === 'granted')
```

Expected: no granted consent before Allow.

**Step 3: Verify queued event injection on Allow**

In console before clicking Allow:

```js
window.puntersAnalytics.track({ event: 'test_pre_consent_event', source: 'smoke' })
localStorage.getItem('puntersClub.analyticsQueue.v1')
```

Expected: queue contains `test_pre_consent_event`.

Click `Allow`, then run:

```js
localStorage.getItem('puntersClub.analyticsQueue.v1')
window.dataLayer.some((item) => item && item.event === 'test_pre_consent_event')
window.dataLayer.some((item) => item && item[0] === 'consent' && item[2]?.analytics_storage === 'granted')
```

Expected: queue is `[]`, queued event is present in `dataLayer`, and consent update granted exists.

**Step 4: Verify queued event discard on Deny**

Clear site data, reload, then run:

```js
window.puntersAnalytics.track({ event: 'test_denied_event', source: 'smoke' })
localStorage.getItem('puntersClub.analyticsQueue.v1')
```

Click `Deny`, then run:

```js
localStorage.getItem('puntersClub.analyticsQueue.v1')
window.dataLayer.some((item) => item && item.event === 'test_denied_event')
```

Expected: queue is `[]`, denied event is not present in `dataLayer`.

**Step 5: Commit smoke-test fixes if needed**

Only if fixes were required:

```bash
git add <changed-files>
git commit -m "fix: align cookie consent browser behavior"
```

---

### Task 8: Final verification

**Files:**
- No source changes expected.

**Step 1: Run unit tests**

Run:

```bash
pnpm test
```

Expected: PASS.

**Step 2: Run production build without enrichment**

Run:

```bash
pnpm exec astro build
```

Expected: PASS. If generated data files changed, inspect and restore unrelated generated JSON churn.

**Step 3: Check diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended files changed or committed.

**Step 4: Final commit if any verification-only changes remain**

```bash
git add <changed-files>
git commit -m "test: verify cookie consent banner"
```

---

## Acceptance checklist

- GTM loader remains present once in `src/layouts/PuntersLayout.astro`.
- `@astrojs/partytown` is configured in `astro.config.mjs` with `forward: ["dataLayer.push"]`.
- GTM loader script uses `type="text/partytown"`.
- `analytics_storage` defaults to `denied` before GTM loads.
- `Allow` stores accepted consent for 6 months and updates GTM consent to `granted`.
- `Deny` stores rejected consent for 6 months and keeps GTM analytics storage denied.
- Captured pre-consent analytics events are stored only in local queue.
- Queued events inject into `dataLayer` after Allow.
- Queued events are discarded after Deny.
- Banner appears as a bottom sticky/fixed overlay with flat background colour.
- Banner controls are keyboard-operable and labelled `Allow` / `Deny`.
- Site renders even if GTM/analytics loading fails.
- `pnpm test` and `pnpm exec astro build` pass.
