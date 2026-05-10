# Afterroar Store Ops UX Audit Notes

**Date:** 2026-05-10  
**Auditor:** AI walkthrough agent (Manus)  
**Store:** `AI Walkthrough Demo Store` at `https://www.afterroar.store/dashboard`  
**Account:** `bot-owner@afterroar.store`

## Access and context

Logged in as `bot-owner@afterroar.store` against the `AI Walkthrough Demo Store` at `https://www.afterroar.store/dashboard`.

## Dashboard / first landing observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| Onboarding state | The page shows a floating **Store Setup Step 1/6** panel even though the provided walkthrough reference says the store is already onboarded and should land straight in the dashboard. Several fields are blank, while store name/address/tax/phone are filled. | High confusion: an owner entering a seeded/active store may think setup is incomplete and may accidentally overwrite setup data. The panel also covers dashboard content. | Dashboard screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-12-34_1180.webp`. |
| Dashboard metrics consistency | Top summary says **Customers 0**, while another dashboard card says **Customers 60**. | High trust issue: store owners depend on these numbers and will not know which KPI is correct. | Dashboard markdown extracted after login. |
| Inventory count consistency | Header/alert says **35 SKUs · 14 low**, while advisor content says **20 items running low**. | Medium/high trust issue: operational urgency and reorder decisions depend on consistent low-stock counts. | Dashboard markdown extracted after login. |
| Customer credit consistency | Advisor says **$2742.54 in credit on the books** and **109 customers have balances**, while the seed reference says 60 total customers and roughly 9 customers with positive balances. | High trust issue: the intelligence layer appears to use stale or cross-store data, or the copy is inaccurate. | Dashboard advisor text. |
| Information hierarchy | The Store Setup panel overlays the right side of the intelligence feed and compresses already dense dashboard content. | Medium usability issue: it reduces scannability and makes the first landing feel cluttered. | Visual dashboard view. |

## Running issue log

Severity scale: **Critical** blocks completing a core flow; **High** materially harms trust or task completion; **Medium** causes confusion/friction; **Low** is polish/accessibility/copy.

| ID | Severity | Location | Issue | Recommendation |
|---|---:|---|---|---|
| UX-001 | High | Dashboard | Completed demo store still shows onboarding setup wizard. | Hide setup once store onboarding is complete, or show a dismissible "finish setup" checklist only when incomplete fields are genuinely required. |
| UX-002 | High | Dashboard | Customer KPI mismatch: 0 customers vs 60 customers. | Normalize KPI definitions and labels; if top card means customers today, label it "Customers Today". |
| UX-003 | Medium | Dashboard | Low-inventory counts differ between summary and advisor. | Use one source of truth for low-stock thresholds/counts and expose threshold rules. |
| UX-004 | High | Dashboard intelligence | Store credit insight claims 109 customers with balances in a 60-customer demo store. | Audit query scope and store isolation; ensure insight values match store-specific data and current seed state. |
| UX-005 | Medium | Dashboard | Floating setup panel covers content and competes with primary daily operations. | Move setup progress to a non-blocking banner/card, or require explicit expansion. |

## Register / checkout observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| Persistent setup overlay | The **Setup: Step 1/6** pill remains visible in full-screen register mode and overlays the bottom-right of the payment/receipt area. | Medium/high: register mode should minimize non-transaction distractions; the setup pill competes with payment completion controls. | Register screenshots from `/dashboard/register`. |
| Search result duplication | Searching `Lightning Bolt` returned two visually identical result buttons: both `MTG Lightning Bolt NM 12 in stock $2.50`. | Medium: cashiers may not know whether results are distinct variants, duplicate inventory rows, or a bug. | Screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-13-39_8290.webp`. |
| Search click reliability | Clicking the first visible search result by element index failed; clicking the second result added the item. | Medium: may indicate overlapping/click-target ambiguity around search results. Human users could experience missed clicks. | Interaction error while selecting result index 14. |
| Customer attach state | After attaching Camila Jackson, the customer appears as a slim orange row at top and icon changes, but there is little contextual detail such as credit balance, loyalty, or remove/switch affordance. | Low/medium: the flow works, but the cashier may not know what benefits or liabilities apply to the attached customer. | Register customer-attach screenshots. |
| Payment flow | Exact cash tender worked and produced receipt `#R-20260510-001`. The sale completed successfully. | Positive finding: core item + customer + cash checkout path is functional. | Sale complete screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-15-22_7778.webp`. |
| Receipt action affordance | Post-sale receipt actions use compact labels/icons: **Print**, **Email**, **Show QR**, **Next Customer**. The QR is already visible even though there is a Show QR action. | Low: minor redundancy/confusion; button intent could be clearer, especially if QR can be hidden/shown. | Sale complete screen. |

Additional issue log entries:

| ID | Severity | Location | Issue | Recommendation |
|---|---:|---|---|---|
| UX-006 | Medium | Register | Setup wizard overlay appears inside register transaction mode. | Suppress onboarding UI in register mode or show it only after exiting the register. |
| UX-007 | Medium | Register search | Product results can appear visually duplicated without differentiating attributes. | Show SKU, set/collector number, variant, condition, source, or inventory ID for duplicate-like results. |
| UX-008 | Medium | Register search | First product search result click target failed in automation while second worked. | Inspect z-index/overlap/click handlers in the search panel; ensure each result row has a stable full-row click target. |
| UX-009 | Low | Register receipt | "Show QR" is offered while the QR is already shown. | Rename to "Hide QR" when visible or hide the QR by default until requested. |

## Inventory observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| Metric consistency | Inventory page reports **Low stock (<3): 9**, while the dashboard reported both **14 low** and **20 items running low**. | High: low-stock status is a core operational task; conflicting values reduce confidence in reorder workflows. | Inventory page screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-16-20_5634.webp`. |
| Category filtering | The category dropdown showed only `TCG Single`, `Sealed Product`, `Board Game`, and `RPG Book`, while visible inventory includes Food & Drink and seeded data includes Accessories. | Medium: users may not be able to filter significant categories or may infer those categories are missing. | Inventory page controls. |
| Stock terminology | Summary says **Unique SKUs 35** and **In stock 35 / 100% of catalog**, which appears to count stocked SKUs rather than total units. | Low/medium: "in stock" can be read as unit count. A clearer label such as "SKUs in stock" would prevent misinterpretation. | Inventory summary cards. |
| Detail freshness | After the test sale, Lightning Bolt stock decreased from 12 in register search to 11 on item detail and the recent sale appeared immediately. | Positive finding: sale-to-inventory and sale-to-history propagation worked. | Lightning Bolt detail page screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-16-35_6849.webp`. |

## Customers observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| Credit consistency | Customers page reports **Store Credit Out: $243.34**, while dashboard intelligence reports **$2742.54** and **109 customers** with balances. | High: the credit liability metric is financially sensitive; values must match across surfaces. | Customers page and dashboard advisor. |
| Customer profile clarity | Customer profile clearly shows credit and loyalty badges, lifetime spend, last-90-day spend, and projected LTV. | Positive finding: the customer profile is concise and useful for staff. | Aria Miller profile screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-17-01_9752.webp`. |
| Network actions | **Link by Email** and **Scan Passport** are visually prominent, but there is no inline warning whether Link by Email sends an actual email. | Medium: staff may hesitate or accidentally trigger external communication. | Customer detail profile. |

## Orders observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| List density | The order list exposes many rows at once with compact status chips and amounts, which is efficient but visually dense. | Low/medium: power users may like it, but new store staff may need stronger column structure or row spacing. | Orders page screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-17-15_7710.webp`. |
| Drawer/overlay stacking | Opening an order uses a right-side detail drawer while the setup pill can also occupy the bottom-right. Before minimizing setup, two overlays competed for attention. | Medium: stacked overlays make detail review feel cluttered and can hide controls. | Order detail screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-17-28_7165.webp`. |
| Order detail content | Order drawer shows customer, items, tax, and total; it is clear for delivered orders. | Positive finding: the side drawer gives fast detail access without losing list context. | WT-1014 detail drawer. |

Additional issue log entries:

| ID | Severity | Location | Issue | Recommendation |
|---|---:|---|---|---|
| UX-010 | High | Dashboard / Inventory / Customers | Operational metrics disagree across pages: low-stock count and store-credit liability are inconsistent. | Audit shared KPI services and define metric semantics once, then reuse across surfaces. |
| UX-011 | Medium | Inventory | Category filter appears incomplete relative to actual catalog categories. | Include all active categories, or label unsupported filters explicitly. |
| UX-012 | Low | Inventory | "In stock 35" may be interpreted as unit count, not SKU count. | Rename to "SKUs in Stock" and optionally show "Total Units On Hand" separately. |
| UX-013 | Medium | Customers | Link-by-email action does not disclose whether it sends customer communication. | Add confirmation/copy such as "Sends an invite email to this address." |
| UX-014 | Medium | Orders | Drawer and setup overlay stack awkwardly. | Ensure only one blocking/floating panel can occupy the right side at a time. |

## Events observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| Date/time display | Event list displays full timestamp strings such as **5/15/2026, 10:00:00 PM**. | Low/medium: readable but not optimized for store operations; seconds add noise and 10 PM may need timezone/context. | Events screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-18-40_8843.webp`. |
| Event selection | Clicking an event expands inline ticket/search controls directly under the row. | Positive: fast access without leaving the list. However, the expanded area can be visually hard to associate with the selected row. | Event expanded screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-18-53_7870.webp`. |
| Disabled ticket action | **Sell Ticket** is disabled with hint "Configure ticket tiers first." | Positive: gives clear prerequisite. Could be stronger if it linked directly to event configuration. | Commander Night expanded controls. |

## Reports observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| Empty visualizations | Sales Analysis showed an empty **Revenue by Day** chart container and a mostly empty **Peak Hours** heatmap even after waiting. | Medium: users may read this as broken, especially because summary data exists above it. | Sales report screenshots `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-19-19_8174.webp` and `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-19-26_6954.webp`. |
| Report data consistency | Sales Analysis shows **Revenue $4411.71 / 46 transactions / avg $95.91**, while Top Sellers and Sales by Category only reflect the single test sale item **Lightning Bolt $2.50**. | High: mixed time windows or mismatched datasets undermine reporting trust. | Sales Analysis 30-day view. |
| Event ROI | Event ROI report correctly uses a table, but all events show zero revenue/players. | Low: acceptable for seeded data, but a demo store would be more convincing if at least one event had activity. | Reports Event ROI screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-19-06_7171.webp`. |

## Staff, devices, integrations, and settings observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| Staff roles | Owner, manager, and cashier rows are clear; role dropdowns are inline for non-owner staff, and Set PIN is visible. | Positive: direct role management is straightforward. | Staff screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-19-41_7628.webp`. |
| Operator switch empty state | Operator switcher says **No PINs set up yet** and tells staff to open Time Clock and set their PIN, but no Time Clock navigation item is visible. | Medium: users are given an instruction they may not be able to follow from the current UI. | Operator switcher screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-20-49_6666.webp`. |
| Devices empty state | Device pairing page has clear copy and a prominent **Pair New Register** CTA. | Positive: empty-state path is clear. | Devices screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-19-55_5683.webp`. |
| Integrations docs links | Every integration has **Docs ↗**, but extracted markdown shows empty links. | Medium: if links are genuinely empty, operators cannot self-serve setup documentation. | Integrations page screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-20-07_8229.webp`. |
| Integration status density | Integrations page is information-rich, but almost every item says **Untested** and **Last tested never**. | Medium: good engineering transparency, but nontechnical users need clearer priority and next steps. | Integrations page. |
| Tax setup inconsistency | Setup wizard displays a sales tax field populated with **8.25**, but Settings > Store shows **Tax Rate %: 0** and Settings overview says **No tax configured**. | High: tax configuration affects checkout accuracy and compliance; conflicting values are critical. | Settings screenshots `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-20-21_6231.webp` and `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-20-35_2919.webp`. |
| Test Mode card wording | Settings shows **TEST MODE LIVE** and "Training mode active" simultaneously. | Medium: "LIVE" and "Training mode" conflict semantically; users may be unsure if actions are real. | Settings overview. |

Additional issue log entries:

| ID | Severity | Location | Issue | Recommendation |
|---|---:|---|---|---|
| UX-015 | Low | Events | Event timestamps include unnecessary seconds and lack timezone/context. | Use store-friendly format such as "Fri, May 15 · 10:00 PM" and optionally show timezone in settings. |
| UX-016 | Medium | Events | Expanded event controls could be visually better attached to the selected event. | Add selected-row highlight, an inline card, or a right drawer. |
| UX-017 | Medium | Reports | Sales charts/heatmaps appear empty despite data being present. | Show populated charts, a skeleton while loading, or an explicit "not enough data" state. |
| UX-018 | High | Reports | Sales KPI totals and top-seller/category breakdown appear to use different datasets or windows. | Verify report queries use identical filters and period boundaries across all widgets. |
| UX-019 | Medium | Staff / Operator Switch | Switcher directs users to Time Clock, but Time Clock is not visible in navigation. | Add Time Clock nav item, deep link, or Set PIN shortcut inside the switcher. |
| UX-020 | Medium | Integrations | Docs links appear empty or nonfunctional. | Populate integration documentation URLs or hide links until docs exist. |
| UX-021 | High | Settings / Setup | Tax value conflicts between setup wizard and settings. | Make setup wizard write to canonical tax settings or clearly label wizard fields as unsaved until persisted. |
| UX-022 | Medium | Settings | "TEST MODE LIVE" conflicts with "Training mode active." | Use mutually exclusive labels such as "Test Mode: On" or "Live Mode: Off." |

## TCG, Intelligence, and Pull Lists observations

| Area | Observation | UX impact | Evidence |
|---|---|---|---|
| TCG search | Catalog search for **Lightning Bolt** completed successfully, returned 30 visible results out of 63, and showed source/game/status metadata. | Positive: external catalog search works and exposes useful result context. | TCG screenshots `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-21-52_8264.webp` and `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-22-07_5440.webp`. |
| Search ranking | The first three results for "Lightning Bolt" were split/dual-faced **Emeritus of Conflict // Lightning Bolt**, not the most common standalone Lightning Bolt printing. | Medium: technically correct Scryfall matching, but operationally surprising; staff searching a common card likely expect exact-name Lightning Bolt first. | TCG result list. |
| Result density | Card result rows include set, rarity, type, foil/std state, market price, and add button. | Positive but dense: power-user useful; needs row scanning support such as exact-match grouping, image size toggle, or sort/filter chips. | TCG result list. |
| Intelligence URL / label | Clicking **Intelligence** navigates to `/dashboard/cash-flow`; breadcrumb reads "Console · Cash Flow" while heading reads "Store Intelligence." | Low/medium: naming mismatch can confuse navigation, bookmarks, and mental model. | Intelligence screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-22-22_9541.webp`. |
| Intelligence KPI consistency | Intelligence shows **Customer Health: 160 total customers**, while Customers page shows **All 60**. It also repeats the dashboard's credit figure **$2742.54**, conflicting with Customers page credit total **$243.34**. | High: store owners will rely on these insights; incorrect denominators or liabilities damage trust. | Intelligence and Customers pages. |
| Intelligence visual density | Store Intelligence contains KPI cards, revenue flow, margin table, smart recommendations, and many insight cards on one page. | Medium: useful but visually heavy; store owners may need clearer prioritization and collapsible sections. | Intelligence page. |
| Pull Lists empty state | Pull Lists gives a clear comics-specific explanation and a prominent **Create First Pull List** action. | Positive: empty state teaches the workflow. | Pull Lists screenshot `/home/ubuntu/screenshots/afterroar_store_2026-05-10_19-22-36_5136.webp`. |
| Pull Lists scope | Pull Lists copy is comics-specific, while Afterroar's core network and store ops product is board-game / TCG-first. | Low/medium: may feel out of place unless comics are an intended vertical for this POS. | Pull Lists page copy. |

Additional issue log entries:

| ID | Severity | Location | Issue | Recommendation |
|---|---:|---|---|---|
| UX-023 | Medium | TCG Catalog | Search ranking returns partial/split-card matches before exact card-name matches. | Boost exact card-name matches and commonly stocked printings; offer "exact name first" sorting. |
| UX-024 | Low | Intelligence | Navigation and URL label cash-flow differ from displayed Intelligence label. | Align route, breadcrumb, sidebar name, and page title. |
| UX-025 | High | Intelligence / Customers | Total customer and store-credit values disagree across modules. | Centralize customer/credit metrics and ensure pages share the same filters and active/inactive customer definitions. |
| UX-026 | Medium | Intelligence | Page presents many competing insight sections at once. | Add priority grouping, collapse low-priority sections, and distinguish "action needed" from "informational." |
| UX-027 | Low | Pull Lists | Comics-specific wording may feel misaligned with board-game/TCG positioning. | Clarify Pull Lists as comic-specific, make it optional/vertical-specific, or broaden wording to subscriptions/holds. |

---

## Severity summary (27 issues total)

- **High (9):** UX-001, UX-002, UX-004, UX-010, UX-018, UX-021, UX-025 — KPI consistency across surfaces is the dominant theme (5 of the 9 high-severity items)
- **Medium (13):** UX-003, UX-005, UX-006, UX-007, UX-008, UX-011, UX-013, UX-014, UX-016, UX-017, UX-019, UX-020, UX-022, UX-023, UX-026
- **Low (5):** UX-009, UX-012, UX-015, UX-024, UX-027
