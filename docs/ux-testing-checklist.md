# UX Testing Checklist — Afterroar Store Ops

**Date:** April 5, 2026
**Tester:** _______________
**Device:** _______________
**Browser:** _______________

Mark each item: ✅ Pass | ⚠️ Issue (note it) | ❌ Broken | N/A

---

## 1. Public Pages (no login)

### Landing Page (afterroar.store)
- [ ] Page loads, hero text readable
- [ ] Sticky nav works on scroll (blur background)
- [ ] "Start Free" button links to /login
- [ ] "See It In Action" scrolls to features
- [ ] Feature grid: all 12 cards display with icons
- [ ] Pricing section: 3 tiers visible, Pro highlighted
- [ ] Competitive comparison table readable
- [ ] Deck builder embed callout with code snippet
- [ ] Footer links work (Pricing, Terms, Privacy, Support)
- [ ] Mobile: single column, no horizontal scroll

### Pricing (/pricing)
- [ ] Three tiers display correctly
- [ ] Add-on modules section visible
- [ ] FAQ accordion opens/closes
- [ ] CTA buttons link to /login
- [ ] Mobile responsive

### Legal (/terms, /privacy)
- [ ] Terms loads, all 12 sections readable
- [ ] Privacy loads, all sections readable
- [ ] Contact emails displayed

### Support (/support)
- [ ] Three support channels visible
- [ ] Migration callout prominent
- [ ] FAQ accordion works

### Status (/status)
- [ ] Page loads without auth
- [ ] Service status dots show (green/red)
- [ ] Uptime percentage displays
- [ ] Response time displays

### Login (/login)
- [ ] Email/password fields visible
- [ ] Google OAuth button visible
- [ ] "Forgot password" link works
- [ ] "Create account" link visible
- [ ] Sign in with test credentials works (bot-owner@afterroar.store / bot1234!)

### Public Buylist (/buylist/full-uproar-games)
- [ ] Page loads without auth
- [ ] Cards listed with condition prices (NM/LP/MP)
- [ ] Demand indicators (Hot/Stocked) visible
- [ ] Store name displayed

### Embeddable Deck Builder (/embed/deck-builder/full-uproar-games)
- [ ] Page loads without auth, light theme
- [ ] Format tabs: Standard, Modern, Pioneer, Commander, Pokémon
- [ ] Standard auto-loads meta decks on page load
- [ ] Tapping an archetype loads the decklist + inventory match
- [ ] Paste Decklist tab accepts text input
- [ ] "Powered by [Store Name]" branding
- [ ] Mobile responsive

### Secure Connect (/connect/full-uproar-games)
- [ ] Page loads, trust signals visible (Encrypted, Read-Only, One-Time, No Revenue)
- [ ] Credential type selector (Shopify/eBay/Other)
- [ ] Continue → input step with name + credential textarea
- [ ] Footer middle dot renders correctly (not literal \u00B7)

### Mobile Timeclock (/clock/full-uproar-games)
- [ ] Page loads without auth
- [ ] Store name displayed
- [ ] PIN entry visible (or "no PINs set up" message)

---

## 2. Dashboard (logged in — use bot-owner@afterroar.store / bot1234!)

### Dashboard Home (/dashboard)
- [ ] Store Advisor cards load
- [ ] Quick action buttons (Open Register, Cash Flow, Trade-Ins, Events)
- [ ] Intelligence insights display (if data exists)
- [ ] "Building offline cache..." banner dismisses after loading

### Sidebar Navigation
- [ ] All nav groups expand/collapse
- [ ] POS: Register, Drawer, Orders, Fulfillment
- [ ] Inventory: Inventory, TCG Singles, Deck Builder, Game Library, Purchase Orders, Stock Counts
- [ ] Customers: Customers, Customer Insights, Gift Cards
- [ ] Events: Events, Tournaments
- [ ] Trade & Returns: Trade-Ins, Returns
- [ ] Reports: Dashboard, Reports, Inventory Health, Sales Analysis, Margins, Staff, Channels, Cash Flow
- [ ] Afterroar Network: Network
- [ ] Admin: Staff, Billing, Settings, Import, etc.
- [ ] Cafe and Consignment appear in correct groups
- [ ] "Register Mode" toggle at bottom works

---

## 3. Register (touch-first testing — use tablet if available)

### Empty State
- [ ] "Scan or search to add items" message
- [ ] Action bar icons visible (Search, Scan, Customer, Quick Add, Manual, Discount, More)
- [ ] PAY button disabled/greyed when cart empty
- [ ] Status bar: date on left, heartbeat clock on right

### Search & Add Items
- [ ] Tap Search icon → search panel opens
- [ ] Type product name → results appear
- [ ] TCG singles show: card image, condition badge, set name, stock count, price
- [ ] Non-TCG items show: name, category, stock, price
- [ ] Out-of-stock items greyed out with "Check network" indicator
- [ ] Tap item → adds to cart, search clears
- [ ] Cart shows: item name, quantity, price
- [ ] TCG items in cart show: thumbnail + condition badge

### Tax
- [ ] Tax line appears in cart total (7% configured)
- [ ] Tax displays immediately (not delayed by cold start)
- [ ] Gift card items show $0 tax

### Payment — Cash
- [ ] Tap PAY → payment method buttons appear (Cash, Card, Gift Card, Credit)
- [ ] Tap Cash → numpad appears
- [ ] Enter amount → change calculated
- [ ] Tip prompt appears (if tips_mode = "always")
- [ ] Tip presets: 15%, 20%, 25% with dollar amounts
- [ ] "Keep the Change" button appears when change > $0
- [ ] "No Tip" skips tip
- [ ] Sale completes → success screen

### Payment — Card (Stripe Terminal)
- [ ] Tap Card → "Waiting for card reader..." screen
- [ ] Terminal S710 prompts for card (if connected)
- [ ] Tip prompt on terminal screen (if configured)
- [ ] Sale completes after card tap
- [ ] Card brand + last 4 on receipt

### Payment — Gift Card
- [ ] Gift card code input appears
- [ ] Auto-formats dashes as you type (XXXX-XXXX-XXXX-XXXX)
- [ ] Barcode scanner auto-fills gift card code
- [ ] Balance checked, amount applied

### Success Screen
- [ ] Checkmark + total displayed
- [ ] Receipt number shown
- [ ] QR code for digital receipt
- [ ] Print / Email buttons work
- [ ] Gift card codes displayed (if sold in this transaction)
- [ ] Loyalty points earned shown
- [ ] "Next Customer" clears everything

### More Menu
- [ ] Price Check: search works, shows price
- [ ] Store Credit: lookup + issue works
- [ ] Returns: find transaction, process return
- [ ] Loyalty: view/redeem points
- [ ] Gift Card: check balance works
- [ ] Gift Card: Sell New → presets ($10/$25/$50/$100) + custom → adds to cart
- [ ] **Buy Cards (Trade-In)**: search → card image + market price → condition buttons → offer → stack → cash/credit payout
- [ ] No Sale: opens drawer
- [ ] Flag Issue: submit works
- [ ] Void Last: finds and voids
- [ ] Order Lookup: find by receipt number

### Buy Cards (Trade-In) — Deep Test
- [ ] Requires customer attached first
- [ ] Search card → results show image + market price
- [ ] Tap card → evaluate screen with large image
- [ ] 5 condition buttons: NM (green) / LP (blue) / MP (yellow) / HP (orange) / DMG (red)
- [ ] Each button shows offer amount
- [ ] Default condition: LP
- [ ] Foil toggle (when foil price available)
- [ ] Quantity stepper (1-10)
- [ ] "Add to Stack" → returns to search
- [ ] Running total at bottom
- [ ] "Cash $XX" and "Credit $XX (+30%)" payout buttons
- [ ] Submission clears stack + shows confirmation

---

## 4. TCG Singles (/dashboard/singles)

- [ ] Stats cards: total singles, value, avg margin, count
- [ ] Game tabs: MTG, Pokémon, Yu-Gi-Oh
- [ ] Card list: images, condition badges (COLOR, not grey), set, price
- [ ] eBay listings tab accessible
- [ ] Bulk pricing tool accessible

---

## 5. Deck Builder (/dashboard/deck-builder)

### Meta Decks
- [ ] Format tabs: Standard, Modern, Pioneer, Commander, Pokémon, Yu-Gi-Oh
- [ ] Standard loads archetypes with meta share percentages
- [ ] Tap archetype → loads real decklist + inventory match
- [ ] In-stock cards: green badge
- [ ] Partial cards: yellow badge
- [ ] Unavailable cards: red badge + substitute suggestion (amber "Try instead:")
- [ ] Network availability: purple "Available nearby: [Store]" (if network stores exist)

### Commander
- [ ] Search for a commander name
- [ ] Commander results show with color identity
- [ ] Select commander → EDHREC synergy cards load
- [ ] Cards matched against inventory

### Paste Decklist
- [ ] Paste a text decklist (e.g. "4 Lightning Bolt\n4 Mountain")
- [ ] "Check Inventory" → matches against store stock
- [ ] Results show with status badges

### Actions
- [ ] "Add All Available to Cart" → navigates to register with cards loaded
- [ ] "In Stock Only" toggle filters to available cards
- [ ] Recommendations section: accessories, foil upgrades, format staples
- [ ] Each recommendation has "+ Add" button

---

## 6. Inventory (/dashboard/inventory)

- [ ] Search by name, barcode, SKU
- [ ] Filter by category
- [ ] Item list: name, category, qty, price
- [ ] Add new item works
- [ ] Scan barcode: unknown triggers learn flow
- [ ] Low stock items highlighted

---

## 7. Events & Tournaments

### Events (/dashboard/events)
- [ ] Event list with status badges
- [ ] Create event: name, date, format, entry fee
- [ ] Ticket tiers: add VIP/GA/Early Bird with capacity + pricing
- [ ] Check-in: search customer, select tier, fee collected

### Tournaments (/dashboard/tournaments)
- [ ] Start tournament from event
- [ ] Swiss pairing generates
- [ ] Report match results
- [ ] Standings update with OMW%

---

## 8. Customers

### Customer List (/dashboard/customers)
- [ ] Search by name, email, phone
- [ ] Customer detail: purchase history, loyalty, credit
- [ ] Add new customer

### Customer Insights (/dashboard/customers/insights)
- [ ] Summary cards: total, active, LTV, retention
- [ ] 12 segment cards with counts
- [ ] Tap segment → customer list loads
- [ ] "Export CSV" downloads file
- [ ] Quick exports: Email Campaign, Lapsed, VIP, Tournament Players

---

## 9. Cafe (/dashboard/cafe)

- [ ] Open tab for a table
- [ ] Add menu items + inventory items
- [ ] KDS view shows pending items
- [ ] Close tab → payment processed
- [ ] Table fee applies (if configured)

---

## 10. Shipping & Fulfillment (/dashboard/fulfillment)

- [ ] Tab bar: To Fulfill, In Progress, Shipped, All
- [ ] Order cards expand with pick list
- [ ] Status transitions: Start Picking → Mark Packed → Buy Label → Mark Shipped
- [ ] Rate shopping: fetches carrier rates
- [ ] Pull Sheet button → opens print-friendly list

---

## 11. Marketplace (/dashboard/singles/ebay)

- [ ] eBay listings page loads
- [ ] List / Delist individual items
- [ ] Bulk listing with filters
- [ ] Condition badges show colors (both listed AND unlisted)

---

## 12. Reports

### Cash Flow (/dashboard/cash-flow)
- [ ] Money in / money out summary
- [ ] Daily chart
- [ ] Smart Recommendations section

### COGS Margins (/dashboard/reports/margins)
- [ ] StatCards: Revenue, COGS, Margin %, Profit
- [ ] Category breakdown table
- [ ] Top/bottom margin items

### Inventory Health (/dashboard/reports/inventory-health)
- [ ] Dead stock with value + "weeks of rent" context
- [ ] Velocity rankings
- [ ] Reorder alerts
- [ ] Category mix bar chart

### Sales Analysis (/dashboard/reports/sales)
- [ ] Revenue + transactions summary
- [ ] Daily revenue bar chart
- [ ] Payment method breakdown
- [ ] Peak hours heatmap
- [ ] Top sellers

### Staff Performance (/dashboard/reports/staff)
- [ ] Leaderboard with medals
- [ ] Per-staff metrics
- [ ] Hours worked

### Channels (/dashboard/reports/channels)
- [ ] Revenue by channel
- [ ] Fulfillment time
- [ ] Shipping margin

### Tip Reports (/api/reports/tips — check via Store Advisor)
- [ ] Tips by staff visible in insights

---

## 13. Staff & Admin

### Staff (/dashboard/staff)
- [ ] Staff list with role badges (active green / inactive grey)
- [ ] Invite new staff
- [ ] Change roles

### Settings (/dashboard/settings)
- [ ] Tax rate configurable
- [ ] Receipt settings
- [ ] Stripe Terminal registration
- [ ] Tip settings (mode, contexts, presets)
- [ ] Shipping settings
- [ ] Loyalty settings
- [ ] Intelligence preferences

### Timeclock (/dashboard/timeclock)
- [ ] Staff time entries visible
- [ ] Clock in/out from dashboard

---

## 14. Afterroar Network (/dashboard/network)

- [ ] Purple accent throughout
- [ ] Network status bar: "Connected to X stores"
- [ ] Overview: partner stores listed
- [ ] Tournaments tab: upcoming/active/completed
- [ ] Leaderboard tab: ELO rankings with medals
- [ ] Benchmarks tab: percentile bars with descriptions

---

## 15. Help Center (/dashboard/help)

- [ ] Search works (type and results filter)
- [ ] Category pills filter articles
- [ ] Popular articles section at top
- [ ] 50 articles load
- [ ] Accordion expand/collapse
- [ ] Related articles at bottom of each article
- [ ] Tags visible under article titles

---

## 16. Cross-Cutting

### Mobile Responsiveness
- [ ] Landing page: single column, readable
- [ ] Register: full screen, touch targets ≥44px
- [ ] Dashboard pages: stack on mobile, tables scroll horizontally
- [ ] Embed deck builder: usable on phone

### Performance
- [ ] First item scan/search: <3 seconds (after settings cached)
- [ ] Tax displays immediately in cart
- [ ] Page transitions: no full-page reload (client-side nav)

### Branding
- [ ] No "AI" text anywhere visible to customers
- [ ] Accent orange (#FF8200) consistent
- [ ] Purple (#7D55C7) for network features only
- [ ] Dark theme consistent across dashboard

### Error Handling
- [ ] Search with no results: friendly empty state
- [ ] Network error: doesn't crash, shows retry message
- [ ] Invalid barcode scan: amber notice, not red error

---

## Notes / Issues Found

| # | Page | Issue | Severity |
|---|------|-------|----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
