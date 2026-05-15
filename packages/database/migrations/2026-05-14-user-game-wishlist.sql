-- Reverted: added a User.gameWishlist JSON column on a misread of repo
-- state — the proper relational WishlistItem table already existed (see
-- schema.prisma line ~645). Drop the unused column so it doesn't tempt
-- future code to write to two places.

ALTER TABLE "User"
DROP COLUMN IF EXISTS "gameWishlist";
