/**
 * One-shot script: upgrade a store's plan to "enterprise" so it has every
 * feature module. Targets the platform-owner test store(s).
 *
 * Usage:
 *   cd apps/ops
 *   npx tsx scripts/upgrade-store-plan.ts <ownerEmail> [plan]
 *
 *   plan defaults to "enterprise". Other values: "free" | "base" | "pro".
 *
 * Reads DATABASE_URL from the current process env (load .env.production
 * first via dotenv-cli or shell before running, e.g.
 *   set -a; . ./.env.production; set +a; npx tsx scripts/upgrade-store-plan.ts info@fulluproar.com)
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const ownerEmail = process.argv[2];
  const plan = (process.argv[3] || "enterprise").toLowerCase();
  const validPlans = ["free", "base", "pro", "enterprise"];

  if (!ownerEmail) {
    console.error("Usage: upgrade-store-plan.ts <ownerEmail> [plan]");
    process.exit(1);
  }
  if (!validPlans.includes(plan)) {
    console.error(`Invalid plan: ${plan}. Valid: ${validPlans.join(", ")}`);
    process.exit(1);
  }

  // Find the user (case-insensitive email)
  const user = await prisma.user.findFirst({
    where: { email: { equals: ownerEmail, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(`No user found for email: ${ownerEmail}`);
    process.exit(1);
  }

  // Find every store this user is staffed on (active)
  const staffRows = await prisma.posStaff.findMany({
    where: { user_id: user.id, active: true },
    include: {
      store: {
        select: { id: true, name: true, slug: true, settings: true },
      },
    },
  });

  if (staffRows.length === 0) {
    console.error(`User ${user.email} (${user.id}) is not active on any store.`);
    process.exit(1);
  }

  console.log(`Found ${staffRows.length} active store(s) for ${user.email}:`);
  for (const s of staffRows) {
    if (!s.store) continue;
    const oldSettings = (s.store.settings as Record<string, unknown>) ?? {};
    const oldPlan = (oldSettings.plan as string) || "(unset)";
    const oldAddons = (oldSettings.addons as string[]) || [];

    const newSettings = {
      ...oldSettings,
      plan,
      // Clear add-ons since enterprise covers everything; keep them for non-enterprise
      addons: plan === "enterprise" ? [] : oldAddons,
    };

    await prisma.posStore.update({
      where: { id: s.store.id },
      data: { settings: newSettings },
    });

    console.log(
      `  ✓ ${s.store.name} (${s.store.slug}) — plan: ${oldPlan} → ${plan}`,
    );
  }

  console.log(`\nDone. Hard-refresh the dashboard for the new modules to take effect.`);
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
