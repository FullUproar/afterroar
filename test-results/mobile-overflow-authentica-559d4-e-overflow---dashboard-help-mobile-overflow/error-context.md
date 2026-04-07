# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-overflow.spec.ts >> authenticated: mobile overflow checks >> mobile overflow - /dashboard/help
- Location: tests\mobile-overflow.spec.ts:32:9

# Error details

```
Error: /dashboard/help has 12 clipped buttons/links:
<button> "Register & Checkout11" overflows right by 28px
<button> "Inventory7" overflows right by 136px
<button> "TCG Singles6" overflows right by 268px
<button> "Customers4" overflows right by 387px
<button> "Events & Tournaments5" overflows right by 590px
<button> "Cafe & Food5" overflows right by 721px
<button> "Trade-Ins & Returns4" overflows right by 907px
<button> "Shipping & Fulfillment4" overflows right by 1103px
<button> "Marketplace & E-Commerce3" overflows right by 1346px
<button> "Reports & Intelligence6" overflows right by 1544px
<button> "Staff & Admin5" overflows right by 1683px
<button> "Troubleshooting5" overflows right by 1839px

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 12
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - main [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e8]:
          - generic [ref=e10]: Offline
          - generic [ref=e11]: Sales will queue locally
        - button "Notifications" [ref=e13]:
          - img [ref=e14]
      - generic [ref=e17]:
        - generic [ref=e19]:
          - button "Go back" [ref=e20]:
            - img [ref=e21]
          - heading "Help Center" [level=1] [ref=e23]
        - textbox "Search help articles..." [ref=e25]
        - generic [ref=e26]:
          - button "All70" [ref=e27]
          - button "Getting Started5" [ref=e28]
          - button "Register & Checkout11" [ref=e29]
          - button "Inventory7" [ref=e30]
          - button "TCG Singles6" [ref=e31]
          - button "Customers4" [ref=e32]
          - button "Events & Tournaments5" [ref=e33]
          - button "Cafe & Food5" [ref=e34]
          - button "Trade-Ins & Returns4" [ref=e35]
          - button "Shipping & Fulfillment4" [ref=e36]
          - button "Marketplace & E-Commerce3" [ref=e37]
          - button "Reports & Intelligence6" [ref=e38]
          - button "Staff & Admin5" [ref=e39]
          - button "Troubleshooting5" [ref=e40]
        - generic [ref=e41]:
          - heading "Popular" [level=2] [ref=e42]
          - generic [ref=e43]:
            - button "★ Your first sale Getting Started" [ref=e44]:
              - generic [ref=e45]: ★
              - generic [ref=e46]: Your first sale
              - generic [ref=e47]: Getting Started
            - button "★ Adding products to your catalog Getting Started" [ref=e48]:
              - generic [ref=e49]: ★
              - generic [ref=e50]: Adding products to your catalog
              - generic [ref=e51]: Getting Started
            - button "★ Card payments with Stripe Terminal Register & Checkout" [ref=e52]:
              - generic [ref=e53]: ★
              - generic [ref=e54]: Card payments with Stripe Terminal
              - generic [ref=e55]: Register & Checkout
            - button "★ Searching Scryfall, Pokemon, and Yu-Gi-Oh catalogs Inventory" [ref=e56]:
              - generic [ref=e57]: ★
              - generic [ref=e58]: Searching Scryfall, Pokemon, and Yu-Gi-Oh catalogs
              - generic [ref=e59]: Inventory
            - 'button "★ Loyalty points: earning, redeeming, and claiming Customers" [ref=e60]':
              - generic [ref=e61]: ★
              - generic [ref=e62]: "Loyalty points: earning, redeeming, and claiming"
              - generic [ref=e63]: Customers
        - generic [ref=e64]:
          - generic [ref=e65]:
            - heading "Getting Started" [level=2] [ref=e66]
            - generic [ref=e67]:
              - button "Your first sale register checkout quick start new store ▼" [ref=e69]:
                - generic [ref=e70]:
                  - text: Your first sale
                  - generic [ref=e71]:
                    - generic [ref=e72]: register
                    - generic [ref=e73]: checkout
                    - generic [ref=e74]: quick start
                    - generic [ref=e75]: new store
                - generic [ref=e76]: ▼
              - button "Adding products to your catalog products inventory catalog barcode ▼" [ref=e78]:
                - generic [ref=e79]:
                  - text: Adding products to your catalog
                  - generic [ref=e80]:
                    - generic [ref=e81]: products
                    - generic [ref=e82]: inventory
                    - generic [ref=e83]: catalog
                    - generic [ref=e84]: barcode
                - generic [ref=e85]: ▼
              - button "Setting up sales tax tax settings stripe tax configuration ▼" [ref=e87]:
                - generic [ref=e88]:
                  - text: Setting up sales tax
                  - generic [ref=e89]:
                    - generic [ref=e90]: tax
                    - generic [ref=e91]: settings
                    - generic [ref=e92]: stripe tax
                    - generic [ref=e93]: configuration
                - generic [ref=e94]: ▼
              - button "Onboarding wizard onboarding setup wizard new store ▼" [ref=e96]:
                - generic [ref=e97]:
                  - text: Onboarding wizard
                  - generic [ref=e98]:
                    - generic [ref=e99]: onboarding
                    - generic [ref=e100]: setup
                    - generic [ref=e101]: wizard
                    - generic [ref=e102]: new store
                - generic [ref=e103]: ▼
              - button "Loading demo data demo sample data testing onboarding ▼" [ref=e105]:
                - generic [ref=e106]:
                  - text: Loading demo data
                  - generic [ref=e107]:
                    - generic [ref=e108]: demo
                    - generic [ref=e109]: sample data
                    - generic [ref=e110]: testing
                    - generic [ref=e111]: onboarding
                - generic [ref=e112]: ▼
          - generic [ref=e113]:
            - heading "Register & Checkout" [level=2] [ref=e114]
            - generic [ref=e115]:
              - button "Processing a cash sale cash payment register checkout ▼" [ref=e117]:
                - generic [ref=e118]:
                  - text: Processing a cash sale
                  - generic [ref=e119]:
                    - generic [ref=e120]: cash
                    - generic [ref=e121]: payment
                    - generic [ref=e122]: register
                    - generic [ref=e123]: checkout
                - generic [ref=e124]: ▼
              - button "Card payments with Stripe Terminal card stripe terminal S710 ▼" [ref=e126]:
                - generic [ref=e127]:
                  - text: Card payments with Stripe Terminal
                  - generic [ref=e128]:
                    - generic [ref=e129]: card
                    - generic [ref=e130]: stripe
                    - generic [ref=e131]: terminal
                    - generic [ref=e132]: S710
                - generic [ref=e133]: ▼
              - button "Using the barcode scanner barcode scanner USB bluetooth ▼" [ref=e135]:
                - generic [ref=e136]:
                  - text: Using the barcode scanner
                  - generic [ref=e137]:
                    - generic [ref=e138]: barcode
                    - generic [ref=e139]: scanner
                    - generic [ref=e140]: USB
                    - generic [ref=e141]: bluetooth
                - generic [ref=e142]: ▼
              - button "Applying discounts discount percentage markdown promotion ▼" [ref=e144]:
                - generic [ref=e145]:
                  - text: Applying discounts
                  - generic [ref=e146]:
                    - generic [ref=e147]: discount
                    - generic [ref=e148]: percentage
                    - generic [ref=e149]: markdown
                    - generic [ref=e150]: promotion
                - generic [ref=e151]: ▼
              - button "Adding manual items manual custom item one-off service ▼" [ref=e153]:
                - generic [ref=e154]:
                  - text: Adding manual items
                  - generic [ref=e155]:
                    - generic [ref=e156]: manual
                    - generic [ref=e157]: custom item
                    - generic [ref=e158]: one-off
                    - generic [ref=e159]: service
                - generic [ref=e160]: ▼
              - button "Split tender payments split tender multiple payments partial ▼" [ref=e162]:
                - generic [ref=e163]:
                  - text: Split tender payments
                  - generic [ref=e164]:
                    - generic [ref=e165]: split
                    - generic [ref=e166]: tender
                    - generic [ref=e167]: multiple payments
                    - generic [ref=e168]: partial
                - generic [ref=e169]: ▼
              - button "Paying with store credit store credit credit ledger customer ▼" [ref=e171]:
                - generic [ref=e172]:
                  - text: Paying with store credit
                  - generic [ref=e173]:
                    - generic [ref=e174]: store credit
                    - generic [ref=e175]: credit
                    - generic [ref=e176]: ledger
                    - generic [ref=e177]: customer
                - generic [ref=e178]: ▼
              - button "Selling and redeeming gift cards gift card redeem balance sell ▼" [ref=e180]:
                - generic [ref=e181]:
                  - text: Selling and redeeming gift cards
                  - generic [ref=e182]:
                    - generic [ref=e183]: gift card
                    - generic [ref=e184]: redeem
                    - generic [ref=e185]: balance
                    - generic [ref=e186]: sell
                - generic [ref=e187]: ▼
              - 'button "Receipts: print, email, and QR receipt print email QR ▼" [ref=e189]':
                - generic [ref=e190]:
                  - text: "Receipts: print, email, and QR"
                  - generic [ref=e191]:
                    - generic [ref=e192]: receipt
                    - generic [ref=e193]: print
                    - generic [ref=e194]: email
                    - generic [ref=e195]: QR
                - generic [ref=e196]: ▼
              - button "Voiding a transaction void reverse cancel undo ▼" [ref=e198]:
                - generic [ref=e199]:
                  - text: Voiding a transaction
                  - generic [ref=e200]:
                    - generic [ref=e201]: void
                    - generic [ref=e202]: reverse
                    - generic [ref=e203]: cancel
                    - generic [ref=e204]: undo
                - generic [ref=e205]: ▼
              - button "Training mode training practice demo new staff ▼" [ref=e207]:
                - generic [ref=e208]:
                  - text: Training mode
                  - generic [ref=e209]:
                    - generic [ref=e210]: training
                    - generic [ref=e211]: practice
                    - generic [ref=e212]: demo
                    - generic [ref=e213]: new staff
                - generic [ref=e214]: ▼
          - generic [ref=e215]:
            - heading "Inventory" [level=2] [ref=e216]
            - generic [ref=e217]:
              - button "Adding inventory items add item inventory SKU product ▼" [ref=e219]:
                - generic [ref=e220]:
                  - text: Adding inventory items
                  - generic [ref=e221]:
                    - generic [ref=e222]: add item
                    - generic [ref=e223]: inventory
                    - generic [ref=e224]: SKU
                    - generic [ref=e225]: product
                - generic [ref=e226]: ▼
              - button "Searching Scryfall, Pokemon, and Yu-Gi-Oh catalogs scryfall pokemon yugioh catalog ▼" [ref=e228]:
                - generic [ref=e229]:
                  - text: Searching Scryfall, Pokemon, and Yu-Gi-Oh catalogs
                  - generic [ref=e230]:
                    - generic [ref=e231]: scryfall
                    - generic [ref=e232]: pokemon
                    - generic [ref=e233]: yugioh
                    - generic [ref=e234]: catalog
                - generic [ref=e235]: ▼
              - button "Bulk CSV import CSV import bulk TCGPlayer ▼" [ref=e237]:
                - generic [ref=e238]:
                  - text: Bulk CSV import
                  - generic [ref=e239]:
                    - generic [ref=e240]: CSV
                    - generic [ref=e241]: import
                    - generic [ref=e242]: bulk
                    - generic [ref=e243]: TCGPlayer
                - generic [ref=e244]: ▼
              - button "Running a stock count stock count physical count audit reconciliation ▼" [ref=e246]:
                - generic [ref=e247]:
                  - text: Running a stock count
                  - generic [ref=e248]:
                    - generic [ref=e249]: stock count
                    - generic [ref=e250]: physical count
                    - generic [ref=e251]: audit
                    - generic [ref=e252]: reconciliation
                - generic [ref=e253]: ▼
              - button "Low stock alerts low stock reorder alert threshold ▼" [ref=e255]:
                - generic [ref=e256]:
                  - text: Low stock alerts
                  - generic [ref=e257]:
                    - generic [ref=e258]: low stock
                    - generic [ref=e259]: reorder
                    - generic [ref=e260]: alert
                    - generic [ref=e261]: threshold
                - generic [ref=e262]: ▼
              - button "Printing barcode labels barcode label print sticker ▼" [ref=e264]:
                - generic [ref=e265]:
                  - text: Printing barcode labels
                  - generic [ref=e266]:
                    - generic [ref=e267]: barcode
                    - generic [ref=e268]: label
                    - generic [ref=e269]: print
                    - generic [ref=e270]: sticker
                - generic [ref=e271]: ▼
              - button "Category management category organize filter catalog ▼" [ref=e273]:
                - generic [ref=e274]:
                  - text: Category management
                  - generic [ref=e275]:
                    - generic [ref=e276]: category
                    - generic [ref=e277]: organize
                    - generic [ref=e278]: filter
                    - generic [ref=e279]: catalog
                - generic [ref=e280]: ▼
          - generic [ref=e281]:
            - heading "TCG Singles" [level=2] [ref=e282]
            - generic [ref=e283]:
              - button "Condition grading guide condition grading NM LP ▼" [ref=e285]:
                - generic [ref=e286]:
                  - text: Condition grading guide
                  - generic [ref=e287]:
                    - generic [ref=e288]: condition
                    - generic [ref=e289]: grading
                    - generic [ref=e290]: NM
                    - generic [ref=e291]: LP
                - generic [ref=e292]: ▼
              - button "Buylist pricing buylist pricing market trade-in ▼" [ref=e294]:
                - generic [ref=e295]:
                  - text: Buylist pricing
                  - generic [ref=e296]:
                    - generic [ref=e297]: buylist
                    - generic [ref=e298]: pricing
                    - generic [ref=e299]: market
                    - generic [ref=e300]: trade-in
                - generic [ref=e301]: ▼
              - button "Market pricing and Scryfall cache market price Scryfall cache price drift ▼" [ref=e303]:
                - generic [ref=e304]:
                  - text: Market pricing and Scryfall cache
                  - generic [ref=e305]:
                    - generic [ref=e306]: market price
                    - generic [ref=e307]: Scryfall
                    - generic [ref=e308]: cache
                    - generic [ref=e309]: price drift
                - generic [ref=e310]: ▼
              - button "One-click bulk repricing reprice bulk markup markdown ▼" [ref=e312]:
                - generic [ref=e313]:
                  - text: One-click bulk repricing
                  - generic [ref=e314]:
                    - generic [ref=e315]: reprice
                    - generic [ref=e316]: bulk
                    - generic [ref=e317]: markup
                    - generic [ref=e318]: markdown
                - generic [ref=e319]: ▼
              - button "Collection CSV import collection CSV import TCGPlayer ▼" [ref=e321]:
                - generic [ref=e322]:
                  - text: Collection CSV import
                  - generic [ref=e323]:
                    - generic [ref=e324]: collection
                    - generic [ref=e325]: CSV
                    - generic [ref=e326]: import
                    - generic [ref=e327]: TCGPlayer
                - generic [ref=e328]: ▼
              - button "Sealed EV calculator sealed EV expected value booster ▼" [ref=e330]:
                - generic [ref=e331]:
                  - text: Sealed EV calculator
                  - generic [ref=e332]:
                    - generic [ref=e333]: sealed
                    - generic [ref=e334]: EV
                    - generic [ref=e335]: expected value
                    - generic [ref=e336]: booster
                - generic [ref=e337]: ▼
          - generic [ref=e338]:
            - heading "Customers" [level=2] [ref=e339]
            - generic [ref=e340]:
              - button "Customer profiles customer profile history account ▼" [ref=e342]:
                - generic [ref=e343]:
                  - text: Customer profiles
                  - generic [ref=e344]:
                    - generic [ref=e345]: customer
                    - generic [ref=e346]: profile
                    - generic [ref=e347]: history
                    - generic [ref=e348]: account
                - generic [ref=e349]: ▼
              - 'button "Loyalty points: earning, redeeming, and claiming loyalty points rewards VIP ▼" [ref=e351]':
                - generic [ref=e352]:
                  - text: "Loyalty points: earning, redeeming, and claiming"
                  - generic [ref=e353]:
                    - generic [ref=e354]: loyalty
                    - generic [ref=e355]: points
                    - generic [ref=e356]: rewards
                    - generic [ref=e357]: VIP
                - generic [ref=e358]: ▼
              - button "Afterroar Passport Afterroar passport network cross-store ▼" [ref=e360]:
                - generic [ref=e361]:
                  - text: Afterroar Passport
                  - generic [ref=e362]:
                    - generic [ref=e363]: Afterroar
                    - generic [ref=e364]: passport
                    - generic [ref=e365]: network
                    - generic [ref=e366]: cross-store
                - generic [ref=e367]: ▼
              - button "Public buylist page buylist public customer-facing trade-in ▼" [ref=e369]:
                - generic [ref=e370]:
                  - text: Public buylist page
                  - generic [ref=e371]:
                    - generic [ref=e372]: buylist
                    - generic [ref=e373]: public
                    - generic [ref=e374]: customer-facing
                    - generic [ref=e375]: trade-in
                - generic [ref=e376]: ▼
          - generic [ref=e377]:
            - heading "Events & Tournaments" [level=2] [ref=e378]
            - generic [ref=e379]:
              - button "Creating events event create format entry fee ▼" [ref=e381]:
                - generic [ref=e382]:
                  - text: Creating events
                  - generic [ref=e383]:
                    - generic [ref=e384]: event
                    - generic [ref=e385]: create
                    - generic [ref=e386]: format
                    - generic [ref=e387]: entry fee
                - generic [ref=e388]: ▼
              - button "Event check-in flow check-in event attendance entry fee ▼" [ref=e390]:
                - generic [ref=e391]:
                  - text: Event check-in flow
                  - generic [ref=e392]:
                    - generic [ref=e393]: check-in
                    - generic [ref=e394]: event
                    - generic [ref=e395]: attendance
                    - generic [ref=e396]: entry fee
                - generic [ref=e397]: ▼
              - button "Swiss pairing tournaments Swiss pairing tournament FNM ▼" [ref=e399]:
                - generic [ref=e400]:
                  - text: Swiss pairing tournaments
                  - generic [ref=e401]:
                    - generic [ref=e402]: Swiss
                    - generic [ref=e403]: pairing
                    - generic [ref=e404]: tournament
                    - generic [ref=e405]: FNM
                - generic [ref=e406]: ▼
              - button "Single elimination brackets bracket elimination knockout playoff ▼" [ref=e408]:
                - generic [ref=e409]:
                  - text: Single elimination brackets
                  - generic [ref=e410]:
                    - generic [ref=e411]: bracket
                    - generic [ref=e412]: elimination
                    - generic [ref=e413]: knockout
                    - generic [ref=e414]: playoff
                - generic [ref=e415]: ▼
              - button "Prize payouts as store credit prize payout store credit ledger ▼" [ref=e417]:
                - generic [ref=e418]:
                  - text: Prize payouts as store credit
                  - generic [ref=e419]:
                    - generic [ref=e420]: prize
                    - generic [ref=e421]: payout
                    - generic [ref=e422]: store credit
                    - generic [ref=e423]: ledger
                - generic [ref=e424]: ▼
          - generic [ref=e425]:
            - heading "Cafe & Food" [level=2] [ref=e426]
            - generic [ref=e427]:
              - button "Opening cafe tabs tab cafe open table ▼" [ref=e429]:
                - generic [ref=e430]:
                  - text: Opening cafe tabs
                  - generic [ref=e431]:
                    - generic [ref=e432]: tab
                    - generic [ref=e433]: cafe
                    - generic [ref=e434]: open
                    - generic [ref=e435]: table
                - generic [ref=e436]: ▼
              - button "Menu builder and modifiers menu modifier food drink ▼" [ref=e438]:
                - generic [ref=e439]:
                  - text: Menu builder and modifiers
                  - generic [ref=e440]:
                    - generic [ref=e441]: menu
                    - generic [ref=e442]: modifier
                    - generic [ref=e443]: food
                    - generic [ref=e444]: drink
                - generic [ref=e445]: ▼
              - button "Table fees table fee hourly play fee game room ▼" [ref=e447]:
                - generic [ref=e448]:
                  - text: Table fees
                  - generic [ref=e449]:
                    - generic [ref=e450]: table fee
                    - generic [ref=e451]: hourly
                    - generic [ref=e452]: play fee
                    - generic [ref=e453]: game room
                - generic [ref=e454]: ▼
              - button "KDS and QR table ordering KDS kitchen QR table ordering ▼" [ref=e456]:
                - generic [ref=e457]:
                  - text: KDS and QR table ordering
                  - generic [ref=e458]:
                    - generic [ref=e459]: KDS
                    - generic [ref=e460]: kitchen
                    - generic [ref=e461]: QR
                    - generic [ref=e462]: table ordering
                - generic [ref=e463]: ▼
              - button "Tab transfer, split, and close transfer split close tab settle ▼" [ref=e465]:
                - generic [ref=e466]:
                  - text: Tab transfer, split, and close
                  - generic [ref=e467]:
                    - generic [ref=e468]: transfer
                    - generic [ref=e469]: split
                    - generic [ref=e470]: close tab
                    - generic [ref=e471]: settle
                - generic [ref=e472]: ▼
          - generic [ref=e473]:
            - heading "Trade-Ins & Returns" [level=2] [ref=e474]
            - generic [ref=e475]:
              - button "Processing a trade-in trade-in buy sell cards ▼" [ref=e477]:
                - generic [ref=e478]:
                  - text: Processing a trade-in
                  - generic [ref=e479]:
                    - generic [ref=e480]: trade-in
                    - generic [ref=e481]: buy
                    - generic [ref=e482]: sell
                    - generic [ref=e483]: cards
                - generic [ref=e484]: ▼
              - button "Cash vs credit payouts cash credit payout bonus ▼" [ref=e486]:
                - generic [ref=e487]:
                  - text: Cash vs credit payouts
                  - generic [ref=e488]:
                    - generic [ref=e489]: cash
                    - generic [ref=e490]: credit
                    - generic [ref=e491]: payout
                    - generic [ref=e492]: bonus
                - generic [ref=e493]: ▼
              - button "Processing returns return refund exchange reverse ▼" [ref=e495]:
                - generic [ref=e496]:
                  - text: Processing returns
                  - generic [ref=e497]:
                    - generic [ref=e498]: return
                    - generic [ref=e499]: refund
                    - generic [ref=e500]: exchange
                    - generic [ref=e501]: reverse
                - generic [ref=e502]: ▼
              - button "Consignment intake and management consignment commission intake consignor ▼" [ref=e504]:
                - generic [ref=e505]:
                  - text: Consignment intake and management
                  - generic [ref=e506]:
                    - generic [ref=e507]: consignment
                    - generic [ref=e508]: commission
                    - generic [ref=e509]: intake
                    - generic [ref=e510]: consignor
                - generic [ref=e511]: ▼
          - generic [ref=e512]:
            - heading "Shipping & Fulfillment" [level=2] [ref=e513]
            - generic [ref=e514]:
              - button "Fulfillment queue fulfillment queue pick pack ▼" [ref=e516]:
                - generic [ref=e517]:
                  - text: Fulfillment queue
                  - generic [ref=e518]:
                    - generic [ref=e519]: fulfillment
                    - generic [ref=e520]: queue
                    - generic [ref=e521]: pick
                    - generic [ref=e522]: pack
                - generic [ref=e523]: ▼
              - button "Pull sheets pull sheet pick list batch warehouse ▼" [ref=e525]:
                - generic [ref=e526]:
                  - text: Pull sheets
                  - generic [ref=e527]:
                    - generic [ref=e528]: pull sheet
                    - generic [ref=e529]: pick list
                    - generic [ref=e530]: batch
                    - generic [ref=e531]: warehouse
                - generic [ref=e532]: ▼
              - button "Shipping labels and rate shopping shipping label ShipStation rate shop ▼" [ref=e534]:
                - generic [ref=e535]:
                  - text: Shipping labels and rate shopping
                  - generic [ref=e536]:
                    - generic [ref=e537]: shipping
                    - generic [ref=e538]: label
                    - generic [ref=e539]: ShipStation
                    - generic [ref=e540]: rate shop
                - generic [ref=e541]: ▼
              - button "Order ingestion API API order ingestion integration ▼" [ref=e543]:
                - generic [ref=e544]:
                  - text: Order ingestion API
                  - generic [ref=e545]:
                    - generic [ref=e546]: API
                    - generic [ref=e547]: order
                    - generic [ref=e548]: ingestion
                    - generic [ref=e549]: integration
                - generic [ref=e550]: ▼
          - generic [ref=e551]:
            - heading "Marketplace & E-Commerce" [level=2] [ref=e552]
            - generic [ref=e553]:
              - button "eBay integration eBay marketplace listing OAuth ▼" [ref=e555]:
                - generic [ref=e556]:
                  - text: eBay integration
                  - generic [ref=e557]:
                    - generic [ref=e558]: eBay
                    - generic [ref=e559]: marketplace
                    - generic [ref=e560]: listing
                    - generic [ref=e561]: OAuth
                - generic [ref=e562]: ▼
              - button "Bulk eBay listing eBay bulk listing TCG ▼" [ref=e564]:
                - generic [ref=e565]:
                  - text: Bulk eBay listing
                  - generic [ref=e566]:
                    - generic [ref=e567]: eBay
                    - generic [ref=e568]: bulk
                    - generic [ref=e569]: listing
                    - generic [ref=e570]: TCG
                - generic [ref=e571]: ▼
              - button "API keys and generic order API API key integration webhook ▼" [ref=e573]:
                - generic [ref=e574]:
                  - text: API keys and generic order API
                  - generic [ref=e575]:
                    - generic [ref=e576]: API
                    - generic [ref=e577]: key
                    - generic [ref=e578]: integration
                    - generic [ref=e579]: webhook
                - generic [ref=e580]: ▼
          - generic [ref=e581]:
            - heading "Reports & Intelligence" [level=2] [ref=e582]
            - generic [ref=e583]:
              - button "Cash flow reports cash flow revenue expenses liquidity ▼" [ref=e585]:
                - generic [ref=e586]:
                  - text: Cash flow reports
                  - generic [ref=e587]:
                    - generic [ref=e588]: cash flow
                    - generic [ref=e589]: revenue
                    - generic [ref=e590]: expenses
                    - generic [ref=e591]: liquidity
                - generic [ref=e592]: ▼
              - button "COGS and margins COGS margin profit cost ▼" [ref=e594]:
                - generic [ref=e595]:
                  - text: COGS and margins
                  - generic [ref=e596]:
                    - generic [ref=e597]: COGS
                    - generic [ref=e598]: margin
                    - generic [ref=e599]: profit
                    - generic [ref=e600]: cost
                - generic [ref=e601]: ▼
              - button "Dead stock and bench warmers dead stock bench warmers slow movers clearance ▼" [ref=e603]:
                - generic [ref=e604]:
                  - text: Dead stock and bench warmers
                  - generic [ref=e605]:
                    - generic [ref=e606]: dead stock
                    - generic [ref=e607]: bench warmers
                    - generic [ref=e608]: slow movers
                    - generic [ref=e609]: clearance
                - generic [ref=e610]: ▼
              - button "Event ROI event ROI revenue attribution ▼" [ref=e612]:
                - generic [ref=e613]:
                  - text: Event ROI
                  - generic [ref=e614]:
                    - generic [ref=e615]: event
                    - generic [ref=e616]: ROI
                    - generic [ref=e617]: revenue
                    - generic [ref=e618]: attribution
                - generic [ref=e619]: ▼
              - button "Store Advisor advisor intelligence insights recommendations ▼" [ref=e621]:
                - generic [ref=e622]:
                  - text: Store Advisor
                  - generic [ref=e623]:
                    - generic [ref=e624]: advisor
                    - generic [ref=e625]: intelligence
                    - generic [ref=e626]: insights
                    - generic [ref=e627]: recommendations
                - generic [ref=e628]: ▼
              - button "Intelligence preferences preferences settings thresholds intelligence ▼" [ref=e630]:
                - generic [ref=e631]:
                  - text: Intelligence preferences
                  - generic [ref=e632]:
                    - generic [ref=e633]: preferences
                    - generic [ref=e634]: settings
                    - generic [ref=e635]: thresholds
                    - generic [ref=e636]: intelligence
                - generic [ref=e637]: ▼
          - generic [ref=e638]:
            - heading "Staff & Admin" [level=2] [ref=e639]
            - generic [ref=e640]:
              - button "Staff management staff team add role ▼" [ref=e642]:
                - generic [ref=e643]:
                  - text: Staff management
                  - generic [ref=e644]:
                    - generic [ref=e645]: staff
                    - generic [ref=e646]: team
                    - generic [ref=e647]: add
                    - generic [ref=e648]: role
                - generic [ref=e649]: ▼
              - button "Roles and permissions (30+) permissions roles access control granular ▼" [ref=e651]:
                - generic [ref=e652]:
                  - text: Roles and permissions (30+)
                  - generic [ref=e653]:
                    - generic [ref=e654]: permissions
                    - generic [ref=e655]: roles
                    - generic [ref=e656]: access control
                    - generic [ref=e657]: granular
                - generic [ref=e658]: ▼
              - 'button "Timeclock: PIN, geofence, adjusted clock-out timeclock PIN clock in clock out ▼" [ref=e660]':
                - generic [ref=e661]:
                  - text: "Timeclock: PIN, geofence, adjusted clock-out"
                  - generic [ref=e662]:
                    - generic [ref=e663]: timeclock
                    - generic [ref=e664]: PIN
                    - generic [ref=e665]: clock in
                    - generic [ref=e666]: clock out
                - generic [ref=e667]: ▼
              - button "Mobile register mobile register access code PIN ▼" [ref=e669]:
                - generic [ref=e670]:
                  - text: Mobile register
                  - generic [ref=e671]:
                    - generic [ref=e672]: mobile
                    - generic [ref=e673]: register
                    - generic [ref=e674]: access code
                    - generic [ref=e675]: PIN
                - generic [ref=e676]: ▼
              - button "Store settings and billing settings billing plan subscription ▼" [ref=e678]:
                - generic [ref=e679]:
                  - text: Store settings and billing
                  - generic [ref=e680]:
                    - generic [ref=e681]: settings
                    - generic [ref=e682]: billing
                    - generic [ref=e683]: plan
                    - generic [ref=e684]: subscription
                - generic [ref=e685]: ▼
          - generic [ref=e686]:
            - heading "Troubleshooting" [level=2] [ref=e687]
            - generic [ref=e688]:
              - button "Scanner not working scanner barcode not working USB ▼" [ref=e690]:
                - generic [ref=e691]:
                  - text: Scanner not working
                  - generic [ref=e692]:
                    - generic [ref=e693]: scanner
                    - generic [ref=e694]: barcode
                    - generic [ref=e695]: not working
                    - generic [ref=e696]: USB
                - generic [ref=e697]: ▼
              - button "Payment failed payment failed error Stripe ▼" [ref=e699]:
                - generic [ref=e700]:
                  - text: Payment failed
                  - generic [ref=e701]:
                    - generic [ref=e702]: payment
                    - generic [ref=e703]: failed
                    - generic [ref=e704]: error
                    - generic [ref=e705]: Stripe
                - generic [ref=e706]: ▼
              - button "Terminal reader setup (S710) terminal S710 reader Stripe ▼" [ref=e708]:
                - generic [ref=e709]:
                  - text: Terminal reader setup (S710)
                  - generic [ref=e710]:
                    - generic [ref=e711]: terminal
                    - generic [ref=e712]: S710
                    - generic [ref=e713]: reader
                    - generic [ref=e714]: Stripe
                - generic [ref=e715]: ▼
              - button "Keyboard shortcut conflicts keyboard shortcut conflict input ▼" [ref=e717]:
                - generic [ref=e718]:
                  - text: Keyboard shortcut conflicts
                  - generic [ref=e719]:
                    - generic [ref=e720]: keyboard
                    - generic [ref=e721]: shortcut
                    - generic [ref=e722]: conflict
                    - generic [ref=e723]: input
                - generic [ref=e724]: ▼
              - button "Sync and offline issues sync offline network connection ▼" [ref=e726]:
                - generic [ref=e727]:
                  - text: Sync and offline issues
                  - generic [ref=e728]:
                    - generic [ref=e729]: sync
                    - generic [ref=e730]: offline
                    - generic [ref=e731]: network
                    - generic [ref=e732]: connection
                - generic [ref=e733]: ▼
    - navigation [ref=e734]:
      - generic [ref=e735]:
        - link "◈ Register" [ref=e736] [cursor=pointer]:
          - /url: /dashboard/register
          - generic [ref=e737]: ◈
          - generic [ref=e738]: Register
        - link "▦ Inventory" [ref=e739] [cursor=pointer]:
          - /url: /dashboard/inventory
          - generic [ref=e740]: ▦
          - generic [ref=e741]: Inventory
        - link "♟ Customers" [ref=e742] [cursor=pointer]:
          - /url: /dashboard/customers
          - generic [ref=e743]: ♟
          - generic [ref=e744]: Customers
        - button "··· More" [ref=e745]:
          - generic [ref=e746]: ···
          - generic [ref=e747]: More
  - alert [ref=e748]
```

# Test source

```ts
  1   | /**
  2   |  * Mobile Overflow Test
  3   |  *
  4   |  * Checks every authenticated page at mobile viewport (390x844) for:
  5   |  * 1. No horizontal overflow (nothing wider than viewport)
  6   |  * 2. All buttons/links are within viewport bounds
  7   |  * 3. No elements clipped at right edge
  8   |  *
  9   |  * Run: npx playwright test tests/mobile-overflow.spec.ts --project=mobile-overflow
  10  |  */
  11  | import { test, expect } from "@playwright/test";
  12  | 
  13  | const PAGES = [
  14  |   "/dashboard",
  15  |   "/dashboard/register",
  16  |   "/dashboard/inventory",
  17  |   "/dashboard/singles",
  18  |   "/dashboard/customers",
  19  |   "/dashboard/events",
  20  |   "/dashboard/cafe",
  21  |   "/dashboard/trade-ins",
  22  |   "/dashboard/returns",
  23  |   "/dashboard/cash-flow",
  24  |   "/dashboard/staff",
  25  |   "/dashboard/settings/store",
  26  |   "/dashboard/settings/payments",
  27  |   "/dashboard/help",
  28  | ];
  29  | 
  30  | test.describe("authenticated: mobile overflow checks", () => {
  31  |   for (const pagePath of PAGES) {
  32  |     test(`mobile overflow - ${pagePath}`, async ({ page }) => {
  33  |       await page.goto(pagePath, { waitUntil: "domcontentloaded", timeout: 30_000 });
  34  |       await page.waitForTimeout(2000);
  35  | 
  36  |       const viewportWidth = 390;
  37  | 
  38  |       // Check for horizontal overflow
  39  |       const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  40  |       const hasHorizontalOverflow = bodyScrollWidth > viewportWidth + 5; // 5px tolerance
  41  | 
  42  |       if (hasHorizontalOverflow) {
  43  |         // Find the offending elements
  44  |         const overflowingElements = await page.evaluate((vw) => {
  45  |           const elements: string[] = [];
  46  |           document.querySelectorAll("*").forEach((el) => {
  47  |             const rect = el.getBoundingClientRect();
  48  |             if (rect.right > vw + 5 && rect.width > 0 && rect.height > 0) {
  49  |               const tag = el.tagName.toLowerCase();
  50  |               const cls = el.className?.toString().slice(0, 60) || "";
  51  |               const text = el.textContent?.slice(0, 30) || "";
  52  |               elements.push(`<${tag} class="${cls}"> "${text}" (right: ${Math.round(rect.right)}px)`);
  53  |             }
  54  |           });
  55  |           return elements.slice(0, 5); // First 5 offenders
  56  |         }, viewportWidth);
  57  | 
  58  |         console.log(`[${pagePath}] Horizontal overflow detected (scrollWidth: ${bodyScrollWidth}px):`);
  59  |         overflowingElements.forEach((el) => console.log(`  - ${el}`));
  60  |       }
  61  | 
  62  |       // Don't hard-fail on overflow for now — just report. Uncomment to enforce:
  63  |       // expect(hasHorizontalOverflow, `Horizontal overflow on ${pagePath}`).toBeFalsy();
  64  | 
  65  |       // Check that all interactive elements (buttons, links) are within viewport
  66  |       const clippedButtons = await page.evaluate((vw) => {
  67  |         const clipped: string[] = [];
  68  |         document.querySelectorAll("button, a, input, select").forEach((el) => {
  69  |           const rect = el.getBoundingClientRect();
  70  |           // Skip invisible/hidden elements
  71  |           if (rect.width === 0 || rect.height === 0) return;
  72  |           // Skip elements far off-screen (in scroll containers)
  73  |           if (rect.top > 2000 || rect.top < -100) return;
  74  | 
  75  |           const rightMargin = vw - rect.right;
  76  |           const leftMargin = rect.left;
  77  | 
  78  |           if (rightMargin < 0) {
  79  |             const tag = el.tagName.toLowerCase();
  80  |             const text = (el.textContent || (el as HTMLInputElement).placeholder || "").slice(0, 30);
  81  |             clipped.push(`<${tag}> "${text}" overflows right by ${Math.abs(Math.round(rightMargin))}px`);
  82  |           }
  83  |           if (leftMargin < 0) {
  84  |             const tag = el.tagName.toLowerCase();
  85  |             const text = (el.textContent || "").slice(0, 30);
  86  |             clipped.push(`<${tag}> "${text}" overflows left by ${Math.abs(Math.round(leftMargin))}px`);
  87  |           }
  88  |         });
  89  |         return clipped;
  90  |       }, viewportWidth);
  91  | 
  92  |       if (clippedButtons.length > 0) {
  93  |         console.log(`[${pagePath}] Clipped interactive elements:`);
  94  |         clippedButtons.forEach((el) => console.log(`  - ${el}`));
  95  |       }
  96  | 
  97  |       // This SHOULD pass — clipped buttons are a real usability problem
  98  |       expect(
  99  |         clippedButtons.length,
  100 |         `${pagePath} has ${clippedButtons.length} clipped buttons/links:\n${clippedButtons.join("\n")}`
> 101 |       ).toBe(0);
      |         ^ Error: /dashboard/help has 12 clipped buttons/links:
  102 |     });
  103 |   }
  104 | });
  105 | 
```