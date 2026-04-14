-- Pollock Party 2026 event badge — seeded for Passport launch event.
-- Issued via /welcome?event=pollock-party-2026

INSERT INTO "PassportBadge" (
  "id", "slug", "name", "description", "iconEmoji", "color", "category",
  "issuerType", "issuerName", "isLimited", "maxSupply"
)
VALUES (
  gen_random_uuid()::text,
  'pollock-party-2026',
  'Pollock Party 2026',
  'You showed up. You signed up. You helped launch the Afterroar Passport at the Pollock Party on April 17, 2026.',
  '🎉',
  '#FBDB65',
  'event',
  'fulluproar',
  'Full Uproar Games',
  true,
  500
)
ON CONFLICT ("slug") DO NOTHING;
