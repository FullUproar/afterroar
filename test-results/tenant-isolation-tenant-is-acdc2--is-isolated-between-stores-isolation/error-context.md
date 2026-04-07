# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tenant-isolation.spec.ts >> tenant isolation >> staff is isolated between stores
- Location: tests\tenant-isolation.spec.ts:142:7

# Error details

```
Error: Staff "Full Uproar" from A

expect(received).toEqual(expected) // deep equality

Expected: "885ccb77-6cc4-4868-b667-6cbf06f61ca8"
Received: undefined
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]: Training Mode — Transactions are not real
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e6]:
        - heading "Afterroar" [level=1] [ref=e7]
        - paragraph [ref=e8]: Full Uproar Games & Café
      - navigation [ref=e9]:
        - button "POS ▸" [ref=e11]:
          - generic [ref=e12]: POS
          - generic [ref=e13]: ▸
        - button "Inventory ▸" [ref=e15]:
          - generic [ref=e16]: Inventory
          - generic [ref=e17]: ▸
        - button "Customers ▸" [ref=e19]:
          - generic [ref=e20]: Customers
          - generic [ref=e21]: ▸
        - button "Events ▸" [ref=e23]:
          - generic [ref=e24]: Events
          - generic [ref=e25]: ▸
        - button "Trade & Returns ▸" [ref=e27]:
          - generic [ref=e28]: Trade & Returns
          - generic [ref=e29]: ▸
        - generic [ref=e30]:
          - button "Reports ▾" [ref=e31]:
            - generic [ref=e32]: Reports
            - generic [ref=e33]: ▾
          - generic [ref=e34]:
            - link "⌂ Dashboard" [ref=e35] [cursor=pointer]:
              - /url: /dashboard
              - generic [ref=e36]: ⌂
              - generic [ref=e37]: Dashboard
            - link "◩ Reports" [ref=e38] [cursor=pointer]:
              - /url: /dashboard/reports
              - generic [ref=e39]: ◩
              - generic [ref=e40]: Reports
            - link "▣ Inventory Health" [ref=e41] [cursor=pointer]:
              - /url: /dashboard/reports/inventory-health
              - generic [ref=e42]: ▣
              - generic [ref=e43]: Inventory Health
            - link "◆ Sales Analysis" [ref=e44] [cursor=pointer]:
              - /url: /dashboard/reports/sales
              - generic [ref=e45]: ◆
              - generic [ref=e46]: Sales Analysis
            - link "△ Margins" [ref=e47] [cursor=pointer]:
              - /url: /dashboard/reports/margins
              - generic [ref=e48]: △
              - generic [ref=e49]: Margins
            - link "⊞ Staff Performance" [ref=e50] [cursor=pointer]:
              - /url: /dashboard/reports/staff
              - generic [ref=e51]: ⊞
              - generic [ref=e52]: Staff Performance
            - link "◎ Channels" [ref=e53] [cursor=pointer]:
              - /url: /dashboard/reports/channels
              - generic [ref=e54]: ◎
              - generic [ref=e55]: Channels
            - link "◎ Cash Flow" [ref=e56] [cursor=pointer]:
              - /url: /dashboard/cash-flow
              - generic [ref=e57]: ◎
              - generic [ref=e58]: Cash Flow
        - button "Afterroar Network ▸" [ref=e60]:
          - generic [ref=e61]: Afterroar Network
          - generic [ref=e62]: ▸
        - button "Admin ▸" [ref=e64]:
          - generic [ref=e65]: Admin
          - generic [ref=e66]: ▸
        - link "▤ Cafe" [ref=e67] [cursor=pointer]:
          - /url: /dashboard/cafe
          - generic [ref=e68]: ▤
          - text: Cafe
      - generic [ref=e69]:
        - paragraph [ref=e70]: Bot Owner · owner
        - button "Sign out" [ref=e71]
        - button "Register Mode" [ref=e72]
    - main [ref=e73]:
      - button "Notifications" [ref=e76]:
        - img [ref=e77]
        - generic [ref=e79]: "6"
      - generic [ref=e81]:
        - generic [ref=e82]:
          - generic [ref=e83]:
            - generic [ref=e84]:
              - heading "Good evening, Bot" [level=2] [ref=e85]
              - paragraph [ref=e86]: Updated 11:39 PM
            - button "Refresh" [ref=e87]:
              - generic [ref=e88]: ↻
              - generic [ref=e89]: Refresh
          - generic [ref=e90]:
            - generic [ref=e92]:
              - generic [ref=e93]: 🚨
              - generic [ref=e94]:
                - heading "40 items running low" [level=3] [ref=e95]
                - paragraph [ref=e96]: Stitch - Rock Star (Enchanted) is most urgent — 1 left, selling 2.1/week. Order by Wednesday or you'll be out. 39 more also need attention.
                - link "Create Purchase Order" [ref=e97] [cursor=pointer]:
                  - /url: /dashboard/purchase-orders
                  - text: Create Purchase Order
                  - generic [ref=e98]: →
              - generic [ref=e99]: "40"
            - generic [ref=e101]:
              - generic [ref=e102]: 📦
              - generic [ref=e103]:
                - heading "$120.00 sitting on the bench" [level=3] [ref=e104]
                - paragraph [ref=e105]: 1 item with zero sales in 30+ days. That's cash trapped on your shelves doing nothing. Mark these down, bundle them, or run a clearance event to free up buying power.
                - link "Run a Promotion" [ref=e106] [cursor=pointer]:
                  - /url: /dashboard/promotions
                  - text: Run a Promotion
                  - generic [ref=e107]: →
              - generic [ref=e108]: $120.00
            - generic [ref=e110]:
              - generic [ref=e111]: 👁️
              - generic [ref=e112]:
                - heading "Noah Williams hasn't been in for 2 weeks" [level=3] [ref=e113]
                - paragraph [ref=e114]: Noah Williams has spent $283.95 lifetime but hasn't been around in 14 days. A text or shout-out at the next event could bring them back.
                - link "View Customers" [ref=e115] [cursor=pointer]:
                  - /url: /dashboard/customers
                  - text: View Customers
                  - generic [ref=e116]: →
              - generic [ref=e117]: "1"
            - generic [ref=e119]:
              - generic [ref=e120]: 💰
              - generic [ref=e121]:
                - heading "$2415.00 in credit collecting dust" [level=3] [ref=e122]
                - paragraph [ref=e123]: 8 customers have credit sitting for 30+ days. That's potential revenue just waiting for a nudge. "Hey, you've got $2415 in credit — new set drops Friday!"
                - link "View Customers" [ref=e124] [cursor=pointer]:
                  - /url: /dashboard/customers
                  - text: View Customers
                  - generic [ref=e125]: →
              - generic [ref=e126]: $2415.00
          - link "View all 17 insights →" [ref=e128] [cursor=pointer]:
            - /url: /dashboard/cash-flow
        - button "🧠 Store Advisor Ask anything about your business" [ref=e130]:
          - generic [ref=e131]:
            - generic [ref=e132]: 🧠
            - generic [ref=e133]:
              - heading "Store Advisor" [level=3] [ref=e134]
              - paragraph [ref=e135]: Ask anything about your business
          - generic [ref=e136]: ▼
        - generic [ref=e137]:
          - generic [ref=e138]:
            - heading "Today" [level=3] [ref=e139]
            - generic [ref=e140]:
              - generic [ref=e141]:
                - generic [ref=e142]: Sales
                - generic [ref=e143]: "0"
              - generic [ref=e144]:
                - generic [ref=e145]: Revenue
                - generic [ref=e146]: $0.00
              - generic [ref=e147]:
                - generic [ref=e148]: Upcoming Events
                - generic [ref=e149]: "1"
            - link "View full cash flow →" [ref=e150] [cursor=pointer]:
              - /url: /dashboard/cash-flow
          - generic [ref=e151]:
            - heading "Recent Activity" [level=3] [ref=e152]
            - table [ref=e154]:
              - rowgroup [ref=e155]:
                - row "Date Type Description Amount" [ref=e156]:
                  - columnheader "Date" [ref=e157]
                  - columnheader "Type" [ref=e158]
                  - columnheader "Description" [ref=e159]
                  - columnheader "Amount" [ref=e160]
              - rowgroup [ref=e161]:
                - 'row "4/4/2026 sale Sale: Catan x1 $44.99" [ref=e162]':
                  - cell "4/4/2026" [ref=e163]
                  - cell "sale" [ref=e164]
                  - 'cell "Sale: Catan x1" [ref=e165]'
                  - cell "$44.99" [ref=e166]
                - 'row "4/3/2026 gift_card_sale Gift card sold: 4EET-T3QN-JF8G-3TD2 $2500.00" [ref=e167]':
                  - cell "4/3/2026" [ref=e168]
                  - cell "gift_card_sale" [ref=e169]
                  - 'cell "Gift card sold: 4EET-T3QN-JF8G-3TD2" [ref=e170]'
                  - cell "$2500.00" [ref=e171]
                - 'row "4/3/2026 sale Sale: Ragavan, Nimble Pilferer x1 $71.50" [ref=e172]':
                  - cell "4/3/2026" [ref=e173]
                  - cell "sale" [ref=e174]
                  - 'cell "Sale: Ragavan, Nimble Pilferer x1" [ref=e175]'
                  - cell "$71.50" [ref=e176]
                - 'row "4/3/2026 sale Sale: Ticket to Ride x1 $44.99" [ref=e177]':
                  - cell "4/3/2026" [ref=e178]
                  - cell "sale" [ref=e179]
                  - 'cell "Sale: Ticket to Ride x1" [ref=e180]'
                  - cell "$44.99" [ref=e181]
                - 'row "4/3/2026 sale Sale: Ticket to Ride x1 $44.99" [ref=e182]':
                  - cell "4/3/2026" [ref=e183]
                  - cell "sale" [ref=e184]
                  - 'cell "Sale: Ticket to Ride x1" [ref=e185]'
                  - cell "$44.99" [ref=e186]
                - 'row "4/3/2026 sale Sale: Drip Coffee (12oz) x1 $3.00" [ref=e187]':
                  - cell "4/3/2026" [ref=e188]
                  - cell "sale" [ref=e189]
                  - 'cell "Sale: Drip Coffee (12oz) x1" [ref=e190]'
                  - cell "$3.00" [ref=e191]
                - 'row "4/3/2026 sale Sale: Drip Coffee (12oz) x2, Monster Energy x1 $9.50" [ref=e192]':
                  - cell "4/3/2026" [ref=e193]
                  - cell "sale" [ref=e194]
                  - 'cell "Sale: Drip Coffee (12oz) x2, Monster Energy x1" [ref=e195]'
                  - cell "$9.50" [ref=e196]
                - 'row "4/3/2026 sale Sale: Wingspan x1 $64.99" [ref=e197]':
                  - cell "4/3/2026" [ref=e198]
                  - cell "sale" [ref=e199]
                  - 'cell "Sale: Wingspan x1" [ref=e200]'
                  - cell "$64.99" [ref=e201]
        - button "🌙 End of Day Summary" [ref=e202]:
          - generic [ref=e203]: 🌙
          - generic [ref=e204]: End of Day Summary
  - alert [ref=e205]
```

# Test source

```ts
  49  | 
  50  |   return {
  51  |     page,
  52  |     storeId: me.store?.id || "",
  53  |     storeName: me.store?.name || "unknown",
  54  |   };
  55  | }
  56  | 
  57  | async function apiGet(page: Page, path: string) {
  58  |   const res = await page.request.get(`${BASE_URL}${path}`);
  59  |   if (!res.ok()) return [];
  60  |   return res.json();
  61  | }
  62  | 
  63  | test.describe("tenant isolation", () => {
  64  |   let a: StoreSession;
  65  |   let b: StoreSession;
  66  |   let bothReady = false;
  67  | 
  68  |   test.beforeAll(async ({ browser }) => {
  69  |     // Try to log in both accounts
  70  |     try {
  71  |       a = await loginAndGetSession(browser, STORE_A);
  72  |       console.log(`Store A: "${a.storeName}" (${a.storeId})`);
  73  |     } catch (e) {
  74  |       console.log(`Store A login failed: ${e}`);
  75  |       return;
  76  |     }
  77  | 
  78  |     try {
  79  |       b = await loginAndGetSession(browser, STORE_B);
  80  |       console.log(`Store B: "${b.storeName}" (${b.storeId})`);
  81  |     } catch (e) {
  82  |       console.log(`Store B login failed: ${e}`);
  83  |       return;
  84  |     }
  85  | 
  86  |     if (a.storeId && b.storeId && a.storeId !== b.storeId) {
  87  |       bothReady = true;
  88  |     } else {
  89  |       console.log("WARNING: Both accounts on same store or login failed. Tests will be skipped.");
  90  |     }
  91  |   });
  92  | 
  93  |   test.afterAll(async () => {
  94  |     await a?.page?.context()?.close();
  95  |     await b?.page?.context()?.close();
  96  |   });
  97  | 
  98  |   test("/api/me returns correct store for each user", async () => {
  99  |     test.skip(!bothReady, "Two stores required");
  100 |     expect(a.storeId).not.toEqual(b.storeId);
  101 | 
  102 |     const meA = await apiGet(a.page, "/api/me");
  103 |     const meB = await apiGet(b.page, "/api/me");
  104 |     expect(meA.store?.id).toEqual(a.storeId);
  105 |     expect(meB.store?.id).toEqual(b.storeId);
  106 |   });
  107 | 
  108 |   test("customers are isolated between stores", async () => {
  109 |     test.skip(!bothReady, "Two stores required");
  110 | 
  111 |     const customersA = await apiGet(a.page, "/api/customers");
  112 |     const customersB = await apiGet(b.page, "/api/customers");
  113 | 
  114 |     for (const c of customersA) {
  115 |       expect(c.store_id, `Customer "${c.name}" from A has wrong store_id`).toEqual(a.storeId);
  116 |     }
  117 |     for (const c of customersB) {
  118 |       expect(c.store_id, `Customer "${c.name}" from B has wrong store_id`).toEqual(b.storeId);
  119 |     }
  120 | 
  121 |     // No ID overlap
  122 |     const idsA = new Set(customersA.map((c: { id: string }) => c.id));
  123 |     for (const c of customersB) {
  124 |       expect(idsA.has(c.id), `Customer "${c.name}" in both stores`).toBeFalsy();
  125 |     }
  126 |   });
  127 | 
  128 |   test("inventory is isolated between stores", async () => {
  129 |     test.skip(!bothReady, "Two stores required");
  130 | 
  131 |     const itemsA = await apiGet(a.page, "/api/inventory");
  132 |     const itemsB = await apiGet(b.page, "/api/inventory");
  133 | 
  134 |     for (const item of itemsA) {
  135 |       expect(item.store_id, `Item "${item.name}" from A`).toEqual(a.storeId);
  136 |     }
  137 |     for (const item of itemsB) {
  138 |       expect(item.store_id, `Item "${item.name}" from B`).toEqual(b.storeId);
  139 |     }
  140 |   });
  141 | 
  142 |   test("staff is isolated between stores", async () => {
  143 |     test.skip(!bothReady, "Two stores required");
  144 | 
  145 |     const staffA = await apiGet(a.page, "/api/staff");
  146 |     const staffB = await apiGet(b.page, "/api/staff");
  147 | 
  148 |     for (const s of staffA) {
> 149 |       expect(s.store_id, `Staff "${s.name}" from A`).toEqual(a.storeId);
      |                                                      ^ Error: Staff "Full Uproar" from A
  150 |     }
  151 |     for (const s of staffB) {
  152 |       expect(s.store_id, `Staff "${s.name}" from B`).toEqual(b.storeId);
  153 |     }
  154 |   });
  155 | 
  156 |   test("events are isolated between stores", async () => {
  157 |     test.skip(!bothReady, "Two stores required");
  158 | 
  159 |     const eventsA = await apiGet(a.page, "/api/events");
  160 |     const eventsB = await apiGet(b.page, "/api/events");
  161 | 
  162 |     for (const e of eventsA) {
  163 |       expect(e.store_id, `Event "${e.name}" from A`).toEqual(a.storeId);
  164 |     }
  165 |     for (const e of eventsB) {
  166 |       expect(e.store_id, `Event "${e.name}" from B`).toEqual(b.storeId);
  167 |     }
  168 |   });
  169 | 
  170 |   test("gift cards are isolated between stores", async () => {
  171 |     test.skip(!bothReady, "Two stores required");
  172 | 
  173 |     const cardsA = await apiGet(a.page, "/api/gift-cards");
  174 |     const cardsB = await apiGet(b.page, "/api/gift-cards");
  175 | 
  176 |     for (const card of cardsA) {
  177 |       expect(card.store_id, `Gift card from A`).toEqual(a.storeId);
  178 |     }
  179 |     for (const card of cardsB) {
  180 |       expect(card.store_id, `Gift card from B`).toEqual(b.storeId);
  181 |     }
  182 |   });
  183 | 
  184 |   test("creating a customer in A does NOT appear in B", async () => {
  185 |     test.skip(!bothReady, "Two stores required");
  186 | 
  187 |     const uniqueName = `IsolationTest_${Date.now()}`;
  188 | 
  189 |     // Create in A
  190 |     const createRes = await a.page.request.post(`${BASE_URL}/api/customers`, {
  191 |       data: { name: uniqueName, email: `${uniqueName.toLowerCase()}@test.com` },
  192 |     });
  193 |     expect(createRes.ok()).toBeTruthy();
  194 |     const created = await createRes.json();
  195 |     expect(created.store_id).toEqual(a.storeId);
  196 | 
  197 |     // Must NOT appear in B
  198 |     const searchB = await apiGet(b.page, `/api/customers?q=${uniqueName}`);
  199 |     const leaked = searchB.find((c: { name: string }) => c.name === uniqueName);
  200 |     expect(leaked, `CRITICAL: Customer "${uniqueName}" leaked from A to B!`).toBeUndefined();
  201 | 
  202 |     // Must appear in A
  203 |     const searchA = await apiGet(a.page, `/api/customers?q=${uniqueName}`);
  204 |     const found = searchA.find((c: { name: string }) => c.name === uniqueName);
  205 |     expect(found).toBeTruthy();
  206 | 
  207 |     // Clean up
  208 |     if (created.id) {
  209 |       await a.page.request.delete(`${BASE_URL}/api/customers/${created.id}`);
  210 |     }
  211 |   });
  212 | });
  213 | 
```