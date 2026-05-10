---
date: 2026-05-10
project: Trubel
title: Trubel subscriptions wired
slug: 2026-05-10-trubel-iap-complete
originalDate: 2026-05-10
---

Subscription Group `Premium` set up in App Store Connect. Monthly and yearly tiers configured. RevenueCat project linked, entitlement `premium` and offering `default` mapped to the right product IDs.

The 3-album free-tier gate is now real: free users hitting album #4 get redirected to `/premium` instead of failing silently downstream.

Paywall got a polish pass too. PlanCard heights are stable now — no more layout jump when the `SAVE X%` badge renders. Restore-Purchases is a proper button instead of buried in settings. Hero container grew from 200 to 240 to give the icon room to breathe.

Apple Review queue next.
