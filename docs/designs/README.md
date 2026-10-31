# Designs

- `screens/` – screenshots of the admin mockups (1440 px). Look at these first.
- `html/` – the mockups' HTML with inline styles, for exact spacing and structure. Open in a browser.

Use them for **layout, hierarchy and interactions**. Colours and fonts come from `docs/design-system.md` (the mockups use an older amber/teal palette).

| File | Screen | In MVP? |
| --- | --- | --- |
| Admin | Overview | Partly (GZW-070, only widgets backed by the API) |
| AdminRoutes | Routes list + detail | Yes (statuses and launch progress per `design-system.md`; its "Pickup points (morning)" list becomes areas served and the four route times) |
| AdminRiders | Riders list + profile | Yes ("Pickup" becomes the rider's boarding area) |
| AdminWaitlists | Waitlists (no longer in the product) | Layout reference only: the Demand screen's cards (GZW-041) |
| AdminDrivers | Drivers and vehicles, application review | Yes |
| AdminSchools | Schools | No – reference for later |
| AdminMap | Live map | No – reference for later |

The sidebar in the mockups lists later features (payments, complaints, payouts, reports…). Show only MVP items.
