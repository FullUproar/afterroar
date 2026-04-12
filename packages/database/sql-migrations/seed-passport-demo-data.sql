-- Seed demo data for Passport UX testing — info@fulluproar.com
-- userId: cmdthb7nc0000ju04vum03kea
-- Run once. Safe to re-run (uses ON CONFLICT DO NOTHING where applicable).

-- 1. Update user profile with game library + passport code
UPDATE "User" SET
  "gameLibrary" = '[
    {"name": "Dumbest Ways To Win", "bggId": null, "addedAt": "2026-03-15T00:00:00Z"},
    {"name": "Crime and Funishment", "bggId": null, "addedAt": "2026-03-15T00:00:00Z"},
    {"name": "Hack Your Deck", "bggId": null, "addedAt": "2026-03-20T00:00:00Z"},
    {"name": "Splice Your Dice", "bggId": null, "addedAt": "2026-03-20T00:00:00Z"},
    {"name": "Wingspan", "bggId": 266192, "addedAt": "2026-02-10T00:00:00Z"},
    {"name": "Twilight Imperium (4th Ed)", "bggId": 233078, "addedAt": "2025-12-25T00:00:00Z"},
    {"name": "Root", "bggId": 237182, "addedAt": "2026-01-05T00:00:00Z"},
    {"name": "Gloomhaven", "bggId": 174430, "addedAt": "2025-11-15T00:00:00Z"},
    {"name": "Ticket to Ride", "bggId": 9209, "addedAt": "2025-06-01T00:00:00Z"},
    {"name": "Catan", "bggId": 13, "addedAt": "2025-03-01T00:00:00Z"}
  ]',
  "passportCode" = 'SHWN2026'
WHERE "id" = 'cmdthb7nc0000ju04vum03kea' AND ("passportCode" IS NULL OR "passportCode" = 'SHWN2026');

-- 2. Seed Loyalty Points across multiple stores
-- Platform points (storeId = NULL)
INSERT INTO "PointsLedger" ("id", "userId", "storeId", "amount", "balance", "action", "category", "description", "metadata", "createdAt")
VALUES
  ('seed_pt_01', 'cmdthb7nc0000ju04vum03kea', NULL, 50, 50, 'SIGNUP_BONUS', 'bonus', 'Welcome to Afterroar! Signup bonus.', NULL, '2026-02-15 10:00:00+00'),
  ('seed_pt_02', 'cmdthb7nc0000ju04vum03kea', NULL, 10, 60, 'REFERRAL', 'bonus', 'Referred a friend to Afterroar', NULL, '2026-03-01 14:00:00+00'),
  ('seed_pt_03', 'cmdthb7nc0000ju04vum03kea', NULL, 5, 65, 'PROFILE_COMPLETE', 'bonus', 'Completed your Passport profile', NULL, '2026-03-05 09:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Store 1: Source Comics & Games (Roseville MN) — using a fake storeId
INSERT INTO "PointsLedger" ("id", "userId", "storeId", "amount", "balance", "action", "category", "description", "metadata", "createdAt")
VALUES
  ('seed_pt_10', 'cmdthb7nc0000ju04vum03kea', 'store_source_comics', 10, 10, 'GEO_CHECKIN', 'checkin', 'Checked in at Source Comics & Games', '{"venueName":"Source Comics & Games"}', '2026-03-10 18:30:00+00'),
  ('seed_pt_11', 'cmdthb7nc0000ju04vum03kea', 'store_source_comics', 25, 35, 'PURCHASE', 'purchase', 'Bought Wingspan + Crime and Funishment', '{"venueName":"Source Comics & Games"}', '2026-03-10 19:00:00+00'),
  ('seed_pt_12', 'cmdthb7nc0000ju04vum03kea', 'store_source_comics', 10, 45, 'EVENT_ATTENDANCE', 'event', 'Attended Friday Night Magic', '{"venueName":"Source Comics & Games","eventName":"FNM March 14"}', '2026-03-14 22:00:00+00'),
  ('seed_pt_13', 'cmdthb7nc0000ju04vum03kea', 'store_source_comics', 15, 60, 'TOURNAMENT_WIN', 'tournament', 'Won Commander Night tournament', '{"venueName":"Source Comics & Games","eventName":"Commander Night","placement":1}', '2026-03-21 23:00:00+00'),
  ('seed_pt_14', 'cmdthb7nc0000ju04vum03kea', 'store_source_comics', 10, 70, 'GEO_CHECKIN', 'checkin', 'Checked in at Source Comics & Games', '{"venueName":"Source Comics & Games"}', '2026-03-28 17:00:00+00'),
  ('seed_pt_15', 'cmdthb7nc0000ju04vum03kea', 'store_source_comics', -20, 50, 'REDEEM_REWARD', 'redemption', 'Redeemed: $5 store credit', '{"venueName":"Source Comics & Games","rewardName":"$5 Store Credit"}', '2026-04-01 16:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Store 2: TableTop Game & Hobby (Overland Park KS)
INSERT INTO "PointsLedger" ("id", "userId", "storeId", "amount", "balance", "action", "category", "description", "metadata", "createdAt")
VALUES
  ('seed_pt_20', 'cmdthb7nc0000ju04vum03kea', 'store_tabletop_hobby', 10, 10, 'GEO_CHECKIN', 'checkin', 'Checked in at TableTop Game & Hobby', '{"venueName":"TableTop Game & Hobby"}', '2026-03-15 13:00:00+00'),
  ('seed_pt_21', 'cmdthb7nc0000ju04vum03kea', 'store_tabletop_hobby', 30, 40, 'PURCHASE', 'purchase', 'Bought Root + expansion', '{"venueName":"TableTop Game & Hobby"}', '2026-03-15 13:30:00+00'),
  ('seed_pt_22', 'cmdthb7nc0000ju04vum03kea', 'store_tabletop_hobby', 10, 50, 'EVENT_ATTENDANCE', 'event', 'Board Game Night (weekly)', '{"venueName":"TableTop Game & Hobby","eventName":"Board Game Night"}', '2026-03-22 21:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Store 3: Hub Hobby Center (Richfield MN)
INSERT INTO "PointsLedger" ("id", "userId", "storeId", "amount", "balance", "action", "category", "description", "metadata", "createdAt")
VALUES
  ('seed_pt_30', 'cmdthb7nc0000ju04vum03kea', 'store_hub_hobby', 10, 10, 'GEO_CHECKIN', 'checkin', 'Checked in at Hub Hobby Center', '{"venueName":"Hub Hobby Center"}', '2026-04-05 11:00:00+00'),
  ('seed_pt_31', 'cmdthb7nc0000ju04vum03kea', 'store_hub_hobby', 15, 25, 'TRADE_IN', 'trade', 'Traded in Magic cards (12 singles)', '{"venueName":"Hub Hobby Center"}', '2026-04-05 11:30:00+00')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed User Activity
INSERT INTO "UserActivity" ("userId", "action", "targetType", "targetId", "metadata", "createdAt")
VALUES
  ('cmdthb7nc0000ju04vum03kea', 'geo_checkin', 'venue', 0, '{"venueId":"store_source_comics","venueName":"Source Comics & Games","lat":45.0061,"lng":-93.1567,"distance":42}', '2026-03-10 18:30:00+00'),
  ('cmdthb7nc0000ju04vum03kea', 'store_event_attendance', 'venue', 0, '{"venueId":"store_source_comics","venueName":"Source Comics & Games","eventName":"FNM March 14","format":"Standard"}', '2026-03-14 22:00:00+00'),
  ('cmdthb7nc0000ju04vum03kea', 'tournament_result', 'venue', 0, '{"venueId":"store_source_comics","venueName":"Source Comics & Games","eventName":"Commander Night","format":"Commander","record":{"wins":3,"losses":1,"draws":0},"placement":1,"totalPlayers":8}', '2026-03-21 23:00:00+00'),
  ('cmdthb7nc0000ju04vum03kea', 'geo_checkin', 'venue', 0, '{"venueId":"store_tabletop_hobby","venueName":"TableTop Game & Hobby","lat":38.9822,"lng":-94.6706,"distance":18}', '2026-03-15 13:00:00+00'),
  ('cmdthb7nc0000ju04vum03kea', 'store_event_attendance', 'venue', 0, '{"venueId":"store_tabletop_hobby","venueName":"TableTop Game & Hobby","eventName":"Board Game Night","format":"Open Play"}', '2026-03-22 21:00:00+00'),
  ('cmdthb7nc0000ju04vum03kea', 'geo_checkin', 'venue', 0, '{"venueId":"store_hub_hobby","venueName":"Hub Hobby Center","lat":44.8831,"lng":-93.2827,"distance":55}', '2026-04-05 11:00:00+00'),
  ('cmdthb7nc0000ju04vum03kea', 'geo_checkin', 'venue', 0, '{"venueId":"store_source_comics","venueName":"Source Comics & Games","lat":45.0061,"lng":-93.1567,"distance":37}', '2026-03-28 17:00:00+00'),
  ('cmdthb7nc0000ju04vum03kea', 'geo_checkin', 'venue', 0, '{"venueId":"store_source_comics","venueName":"Source Comics & Games","lat":45.0061,"lng":-93.1567,"distance":29}', '2026-04-08 18:15:00+00');

-- 4. Add more consent grants for demo purposes
INSERT INTO "UserConsent" ("id", "userId", "category", "granted", "grantedAt", "source")
VALUES
  ('seed_consent_01', 'cmdthb7nc0000ju04vum03kea', 'platform_product', true, '2026-03-01 10:00:00+00', 'seed'),
  ('seed_consent_02', 'cmdthb7nc0000ju04vum03kea', 'game_night_functional', true, '2026-03-01 10:00:00+00', 'seed'),
  ('seed_consent_03', 'cmdthb7nc0000ju04vum03kea', 'crew_activity', true, '2026-03-01 10:00:00+00', 'seed'),
  ('seed_consent_04', 'cmdthb7nc0000ju04vum03kea', 'fulluproar_personalization', false, '2026-03-01 10:00:00+00', 'seed')
ON CONFLICT ("userId", "category") DO NOTHING;
