# Afterroar Store Ops Research Report: Loyalty Points Systems for FLGS
**Author:** Manus AI
**Date:** April 2, 2026

This report synthesizes deep research into how Friendly Local Game Stores (FLGS) currently handle loyalty programs, what the underlying financial mechanics are, and how Afterroar Store Ops can build a best-in-class loyalty module that drives community engagement while protecting store cash flow.

## 1. The Current State of FLGS Loyalty

The landscape of FLGS loyalty programs is highly fragmented. Stores typically fall into one of four categories regarding how they reward repeat customers [1]:

**The Low-Tech Punch Card**
The simplest and most common system for smaller stores. Customers receive a physical stamp or punch for every $10 spent or every event attended. After 10 punches, they receive a free booster pack or a $10 discount. While cheap to implement, this system provides zero data to the store owner, is highly susceptible to fraud (customers punching their own cards), and does not integrate with the Point of Sale (POS) system.

**Digital Points Systems**
Stores using generalized retail POS systems like Square or Lightspeed often utilize their built-in digital points modules. Customers earn points based on spending (e.g., 1 point per dollar) and redeem them at fixed tiers (e.g., 500 points for $5 off). These systems are automated and provide good data, but they treat game stores like coffee shops — they do not distinguish between high-margin items (accessories) and low-margin items (sealed TCG product) when awarding points [16] [22].

**Store Credit as "Loyalty"**
Many stores, particularly those heavily focused on Trading Card Games (TCGs), conflate store credit with loyalty. They offer aggressive trade-in bonuses (e.g., 60% cash value vs. 80% store credit value) and consider this their primary retention mechanism. While effective for TCG players, it completely ignores board game buyers, RPG players, and casual shoppers who do not trade in singles [1].

**Platform-Specific Loyalty (e.g., TCGPlayer)**
Stores that sell heavily online are often subject to platform loyalty programs. TCGPlayer offers a subscription service that includes a "Loyalty Bonus" in the form of promotional store credit for qualifying purchases. This incentivizes buyers to use the platform, which can indirectly drive sales to the FLGS, but the store does not own the customer relationship or the loyalty data [2] [32].

## 2. The Financial Mechanics: Breakage and Liability

The most critical insight for Afterroar Store Ops is that loyalty points are a financial liability, not a marketing expense. When a store issues a point, they are issuing a deferred discount that sits on their balance sheet.

**The Reality of Breakage**
Breakage refers to the percentage of issued loyalty points that are never redeemed. In the broader retail industry, breakage rates can reach as high as 80%, though typical rates for engaged specialty retail are between 20% and 40% [7] [10]. 

Breakage is a double-edged sword. Financially, unredeemed points represent pure profit for the store — the liability is extinguished without a cash outflow. However, excessively high breakage indicates that the program is not actually driving customer behavior. If customers are not redeeming points, the program is failing as a retention tool [9] [11].

**Expiration Policies**
Expiration is the primary mechanism for managing liability and forcing breakage. Industry best practice suggests a 12-month rolling expiration (points expire 12 months after they are earned) or an inactivity expiration (all points expire if the customer does not make a purchase within 6 months). This prevents the accumulation of massive, unpredictable liabilities on the store's books [8] [35].

## 3. Competitive Landscape: POS Loyalty Features

The POS systems currently dominating the FLGS market have distinct approaches to loyalty:

*   **BinderPOS and ShadowPOS:** These systems are highly specialized for TCG inventory and buylists but lack robust, native loyalty programs. They focus almost entirely on store credit management [14] [15].
*   **Square:** Offers a flexible, automated points system with customizable rewards and customer data analytics. It is praised for ease of use but criticized for high subscription costs for the loyalty add-on [16] [19].
*   **Lightspeed:** Provides omnichannel loyalty programs integrated with the POS. It is powerful but often considered too complex and expensive for a typical FLGS [22] [27].

This presents a massive gap for Afterroar Store Ops. The TCG-focused competitors lack loyalty entirely, while the generalized competitors lack TCG awareness.

## 4. Actionable Insights for Afterroar Store Ops

To build a best-in-class loyalty module, Afterroar Store Ops should implement the following features:

**1. Differentiate Points from Store Credit**
The system must explicitly separate `PosCustomer.loyalty_points` from `PosCustomer.credit_balance_cents`. Store credit is a cash equivalent owed to the customer (usually from trade-ins). Loyalty points are a promotional currency. When a customer pays with store credit, they should *not* earn loyalty points on that portion of the transaction, as it amounts to double-rewarding [30].

**2. Non-Cash Redemption Steering**
The system should heavily incentivize redeeming points for event entries rather than product discounts. A $15 tournament entry fee costs the store very little in actual marginal cost (table space, prize allocation), whereas a $15 discount on a sealed booster box directly hits a low-margin product. Afterroar should make event redemption the default, most attractive option in the UI.

**3. The Liability Dashboard**
The Store Ops intelligence layer must surface the outstanding points liability to the store owner. This should include:
*   Total points outstanding and their cash-equivalent liability.
*   Trailing 12-month breakage rate.
*   Effective discount percentage (Earn Rate × Redemption Rate × Breakage).

**4. Tiered Earn Rates by Product Category**
Unlike Square, Afterroar Store Ops knows what the store is selling. The system should allow owners to set different earn rates based on product categories. For example, high-margin accessories (sleeves, dice) might earn 2 points per dollar, while low-margin sealed TCG product earns 0.5 points per dollar.

**5. The Cross-Store Network (Future)**
While V1 should keep points scoped to individual stores to avoid liability clearinghouse complexities, the architecture should support coalition loyalty in the future. The Afterroar `PointsLedger` in HQ is already perfectly positioned to act as a unified player passport, tracking engagement across multiple venues [3] [4].

## References
[1] Reddit. "Does your FLGS have a loyalty/discount program? If so, what?" r/boardgames.
[2] TCGplayer.com. "TCGplayer Subscription FAQ."
[3] Enable3. "Coalition Loyalty Programs: The Complete 2026 Coalition Loyalty Guide."
[4] Medium. "Understanding Coalition Loyalty Programs: A Comprehensive Financial Perspective."
[7] Travel Data Daily. "Breakage: Good or Bad for Loyalty Programs?"
[8] Rivo.io. "15 Points Expiry Impact Statistics: Critical Data for Shopify."
[9] CMSWire. "The Loyalty Program Illusion: Why Points Don't Equal Preference."
[10] ScienceDirect. "Breakage analysis for profitability management."
[11] Cordial. "Why customers are leaving your loyalty program."
[14] Tenereteam. "Binder Reviews."
[15] ShadowPOS. "Point of Sale Software for Trading Card Stores."
[16] Merchant Maverick. "Square Loyalty: Pricing, Features & When To Use It."
[19] Reddit. "Square Loyalty." r/coffeeshopowners.
[22] NerdWallet. "Lightspeed Retail POS Review 2026."
[27] G2. "Lightspeed Retail Pros and Cons."
[30] Reddit. "Points on purchases made with trade credit?" r/GameStop.
[32] TCGplayer.com. "Promotional Store Credit Disclaimer."
[35] Voucherify. "Guide to loyalty points expiration."
