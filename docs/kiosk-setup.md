# Register Tablet Setup — Kiosk Mode

How to lock a tablet down so it ONLY runs Afterroar Store Ops. No Candy Crush, no Instagram, no distractions.

---

## iPad (Recommended)

### Step 1: Install the PWA
1. Open Safari on the iPad
2. Go to `ops.afterroar.store`
3. Sign in with the store's cashier account
4. Tap the Share button (box with arrow) → "Add to Home Screen"
5. Name it "Store Ops" → Add
6. The app icon appears on the home screen

### Step 2: Enable Guided Access (Single App Kiosk Mode)
1. Go to **Settings → Accessibility → Guided Access**
2. Turn ON Guided Access
3. Set a passcode (owner/manager knows this, not the cashier)
4. Under "Time Limits" → optionally set an end-of-day auto-exit

### Step 3: Lock to Store Ops
1. Open the Store Ops PWA from the home screen
2. **Triple-click the Side Button** (or Home Button on older iPads)
3. Guided Access screen appears → tap "Start"
4. The iPad is now locked to Store Ops. No home button, no app switching, no notifications.

### Step 4: To Exit Guided Access
- **Triple-click the Side Button** → enter the passcode → "End"
- Only the owner/manager should know this passcode

### Additional Lockdown (Optional)
- **Settings → Screen Time → Content & Privacy Restrictions**: Disable Safari, App Store, Settings access
- **Settings → General → Background App Refresh**: Turn off for everything except Store Ops
- **MDM (Mobile Device Management)**: For stores with multiple iPads, use Apple Business Manager + an MDM like Jamf or Mosyle for enterprise-level lockdown

---

## Android Tablet

### Step 1: Install the PWA
1. Open Chrome on the tablet
2. Go to `ops.afterroar.store`
3. Sign in with the cashier account
4. Chrome shows "Add to Home Screen" banner → tap it
5. Or: Chrome menu (⋮) → "Install app" or "Add to Home Screen"

### Step 2: Screen Pinning (Basic Kiosk)
1. Go to **Settings → Security → Screen Pinning** (or "Lock Task" on Samsung)
2. Turn it ON
3. Open Store Ops from home screen
4. Open Recent Apps → tap the Store Ops icon → "Pin"
5. Tablet is locked to Store Ops

### Step 3: To Unpin
- Hold Back + Recents buttons simultaneously
- Enter PIN/pattern (owner/manager only)

### Stronger Lockdown (Samsung/Enterprise)
- **Samsung Knox Kiosk Mode**: Lock to a single app with no status bar, no navigation bar
- **Android Enterprise**: Use Google's managed device mode
- **Third-party kiosk apps**: "SureLock" or "KioWare" for full lockdown

---

## Recommended Hardware Kits

### Standard Kit (Countertop Register)
- iPad 10th Gen ($349) or Samsung Galaxy Tab A9+ ($229)
- OtterBox Defender case ($70) or equivalent rugged case
- Kensington tablet stand ($40)
- Stripe Reader S710 ($359)
- **Total: ~$820 (iPad) or ~$700 (Android)**

### Mobile Kit (Cons / Events / Roaming)
- iPad Mini or Samsung Galaxy Tab A9 (8.7")
- Rugged case with hand strap
- Stripe Reader M2 ($59) — Bluetooth
- **Total: ~$500-600**

### Budget Kit (Getting Started)
- Any existing tablet (even an old iPad)
- Stripe Reader M2 ($59) — Bluetooth
- Phone mount / cheap stand
- **Total: ~$60 + whatever tablet you already have**

---

## Network Requirements
- **WiFi**: Standard. Tablet and S710 on the same network.
- **Cellular**: S710 has built-in LTE. Tablet needs WiFi to the S710's local network OR use the M2 via Bluetooth.
- **Offline**: PWA caches the app and data. Works through internet blips. Cash-only mode for extended outages.
