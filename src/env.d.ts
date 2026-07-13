/// <reference path="../.astro/types.d.ts" />

declare module "@vercel/analytics" {
  export function inject(): void;
}
