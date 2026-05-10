// Provision the "AI Walkthrough" store for the bot-owner / bot-manager /
// bot-cashier accounts. Idempotent: run once to create everything, run
// again with --force to wipe and re-seed.
//
// Seeds:
//   - 1 PosStore (slug: ai-walkthrough)
//   - 3 PosStaff rows (owner/manager/cashier roles, one per bot user)
//   - ~35 inventory items across TCG / sealed / board game / accessory /
//     food-drink categories
//   - 60 customers (mix of credit balances, returning + first-time)
//   - 2 upcoming events + 2 completed events
//   - 50 historical orders (last 30 days, paid via cash/credit only —
//     no real Stripe payment methods, deliberately)
//   - 4 cafe tabs (2 open, 2 closed)
//   - 1 completed tournament with players + matches + 1 upcoming
//   - 6 gift cards (mix of activated + redeemed)
//   - Loyalty entries for 25 customers
//   - 5 game checkouts (3 returned, 2 open)
//   - Store settings: onboarded = true (skips the 6-step wizard)
//
// Usage:
//   cd c:/dev/FULL UPROAR PLATFORM/ops-afterroar-store/apps/ops
//   node scripts/seed-bot-store.mjs           # create if missing
//   node scripts/seed-bot-store.mjs --force   # wipe + reseed

import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenvConfig({ path: '.env.local' });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FORCE = process.argv.includes('--force');
const STORE_SLUG = 'ai-walkthrough';
const STORE_NAME = 'AI Walkthrough Demo Store';

const BOT_EMAILS = {
  owner: 'bot-owner@afterroar.store',
  manager: 'bot-manager@afterroar.store',
  cashier: 'bot-cashier@afterroar.store',
};

// ── Inventory data ────────────────────────────────────────────────────
const INVENTORY = [
  // TCG singles (MTG)
  { name: 'Lightning Bolt', category: 'tcg_single', price_cents: 250, cost_cents: 100, quantity: 12, attributes: { game: 'MTG', condition: 'NM', set_name: 'Foundations' } },
  { name: 'Sol Ring', category: 'tcg_single', price_cents: 100, cost_cents: 30, quantity: 20, attributes: { game: 'MTG', condition: 'NM', set_name: 'Foundations' } },
  { name: 'Fatal Push', category: 'tcg_single', price_cents: 350, cost_cents: 150, quantity: 8, attributes: { game: 'MTG', condition: 'NM', set_name: 'Aetherdrift' } },
  { name: 'Counterspell', category: 'tcg_single', price_cents: 150, cost_cents: 50, quantity: 14, attributes: { game: 'MTG', condition: 'NM', set_name: 'Foundations' } },
  { name: 'Wrath of God', category: 'tcg_single', price_cents: 1500, cost_cents: 700, quantity: 3, attributes: { game: 'MTG', condition: 'NM', set_name: 'Foundations' } },
  { name: 'The One Ring', category: 'tcg_single', price_cents: 12000, cost_cents: 8000, quantity: 1, attributes: { game: 'MTG', condition: 'NM', set_name: 'Lord of the Rings' } },
  // TCG singles (Pokemon)
  { name: 'Charizard ex', category: 'tcg_single', price_cents: 4500, cost_cents: 2500, quantity: 2, attributes: { game: 'Pokemon', condition: 'NM', set_name: 'Prismatic Evolutions' } },
  { name: 'Pikachu VMAX', category: 'tcg_single', price_cents: 2800, cost_cents: 1800, quantity: 1, attributes: { game: 'Pokemon', condition: 'NM', set_name: 'Vivid Voltage' } },
  { name: 'Mewtwo VSTAR', category: 'tcg_single', price_cents: 1800, cost_cents: 900, quantity: 3, attributes: { game: 'Pokemon', condition: 'NM', set_name: 'Pokemon GO' } },
  { name: 'Eevee Heroes Booster Pack', category: 'tcg_single', price_cents: 800, cost_cents: 350, quantity: 25, attributes: { game: 'Pokemon', condition: 'NM' } },
  // Sealed
  { name: 'MTG Play Booster Box - Foundations', category: 'sealed', price_cents: 12999, cost_cents: 8500, quantity: 6, attributes: { game: 'MTG', product_type: 'booster_box' } },
  { name: 'MTG Commander Deck - Pioneer', category: 'sealed', price_cents: 4499, cost_cents: 2800, quantity: 5, attributes: { game: 'MTG', product_type: 'commander_deck' } },
  { name: 'Pokemon Elite Trainer Box', category: 'sealed', price_cents: 6999, cost_cents: 4500, quantity: 4, attributes: { game: 'Pokemon', product_type: 'etb' } },
  { name: 'Pokemon Booster Bundle', category: 'sealed', price_cents: 2799, cost_cents: 1800, quantity: 8, attributes: { game: 'Pokemon', product_type: 'bundle' } },
  // Board Games
  { name: 'Wingspan', category: 'board_game', price_cents: 6499, cost_cents: 3800, quantity: 3, attributes: { publisher: 'Stonemaier', players: '1-5', age: '10+' } },
  { name: 'Catan', category: 'board_game', price_cents: 4499, cost_cents: 2500, quantity: 4, attributes: { publisher: 'Catan Studio', players: '3-4', age: '10+' } },
  { name: 'Ticket to Ride', category: 'board_game', price_cents: 4499, cost_cents: 2500, quantity: 3, attributes: { publisher: 'Days of Wonder', players: '2-5', age: '8+' } },
  { name: 'Spirit Island', category: 'board_game', price_cents: 7999, cost_cents: 4800, quantity: 2, attributes: { publisher: 'Greater Than Games', players: '1-4', age: '13+' } },
  { name: 'Brass: Birmingham', category: 'board_game', price_cents: 8499, cost_cents: 5200, quantity: 2, attributes: { publisher: 'Roxley', players: '2-4', age: '14+' } },
  { name: 'Cascadia', category: 'board_game', price_cents: 3999, cost_cents: 2300, quantity: 4, attributes: { publisher: 'Flatout Games', players: '1-4', age: '10+' } },
  // Accessories
  { name: 'Dragon Shield Sleeves (100ct, Matte Black)', category: 'accessory', price_cents: 1199, cost_cents: 600, quantity: 20, attributes: { type: 'sleeves' } },
  { name: 'Dragon Shield Sleeves (100ct, Matte White)', category: 'accessory', price_cents: 1199, cost_cents: 600, quantity: 15, attributes: { type: 'sleeves' } },
  { name: 'Ultra Pro Deck Box', category: 'accessory', price_cents: 499, cost_cents: 200, quantity: 15, attributes: { type: 'deck_box' } },
  { name: 'Chessex 7-Die Set (Black)', category: 'accessory', price_cents: 999, cost_cents: 400, quantity: 10, attributes: { type: 'dice' } },
  { name: 'Playmat - Forest', category: 'accessory', price_cents: 2499, cost_cents: 1200, quantity: 5, attributes: { type: 'playmat' } },
  { name: 'Token Set - Spindown D20', category: 'accessory', price_cents: 599, cost_cents: 250, quantity: 12, attributes: { type: 'tokens' } },
  // Food & Drink
  { name: 'Drip Coffee', category: 'food_drink', price_cents: 300, cost_cents: 50, quantity: 999, attributes: { type: 'hot_drink' } },
  { name: 'Latte', category: 'food_drink', price_cents: 500, cost_cents: 100, quantity: 999, attributes: { type: 'hot_drink' } },
  { name: 'Iced Coffee', category: 'food_drink', price_cents: 400, cost_cents: 80, quantity: 999, attributes: { type: 'cold_drink' } },
  { name: 'Soda Can', category: 'food_drink', price_cents: 200, cost_cents: 60, quantity: 60, attributes: { type: 'cold_drink' } },
  { name: 'Bottled Water', category: 'food_drink', price_cents: 150, cost_cents: 40, quantity: 80, attributes: { type: 'cold_drink' } },
  { name: 'Snickers Bar', category: 'food_drink', price_cents: 200, cost_cents: 70, quantity: 30, attributes: { type: 'snack' } },
  { name: 'Chips - Mixed Box', category: 'food_drink', price_cents: 250, cost_cents: 80, quantity: 25, attributes: { type: 'snack' } },
  { name: 'Pizza Slice', category: 'food_drink', price_cents: 599, cost_cents: 200, quantity: 999, attributes: { type: 'hot_food' } },
  { name: 'Personal Pizza', category: 'food_drink', price_cents: 1299, cost_cents: 400, quantity: 999, attributes: { type: 'hot_food' } },
];

const FIRST_NAMES = ['Liam','Noah','Oliver','Emma','Olivia','Charlotte','Amelia','James','Sophia','Lucas','Henry','Benjamin','Theodore','Mia','Isabella','Evelyn','Harper','Luna','Camila','Elizabeth','Jack','Mason','Ethan','Alexander','Daniel','Hazel','Violet','Aurora','Bella','Skylar','Zoe','Maya','Logan','Sebastian','Owen','Wyatt','Penelope','Layla','Riley','Nora','Lily','Aurora','Aria','Mila','Avery','Audrey','Brooklyn','Claire','Ella'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott'];

function rand(n) { return Math.floor(Math.random() * n); }
function choice(arr) { return arr[rand(arr.length)]; }
function daysAgo(d) { const x = new Date(); x.setDate(x.getDate() - d); return x; }
function daysFromNow(d) { const x = new Date(); x.setDate(x.getDate() + d); return x; }

async function findUser(email) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`User not found: ${email}`);
  return u;
}

async function existing() {
  return prisma.posStore.findUnique({ where: { slug: STORE_SLUG } });
}

async function wipe(storeId) {
  // Delete order matters — children before parents.
  await prisma.posOrderItem.deleteMany({ where: { order: { store_id: storeId } } });
  await prisma.posOrder.deleteMany({ where: { store_id: storeId } });
  await prisma.posTournamentMatch.deleteMany({ where: { tournament: { store_id: storeId } } });
  await prisma.posTournamentPlayer.deleteMany({ where: { tournament: { store_id: storeId } } });
  await prisma.posTournament.deleteMany({ where: { store_id: storeId } });
  await prisma.posEventTicket.deleteMany({ where: { event: { store_id: storeId } } });
  await prisma.posEventCheckin.deleteMany({ where: { event: { store_id: storeId } } });
  await prisma.posTabItem.deleteMany({ where: { tab: { store_id: storeId } } });
  await prisma.posTab.deleteMany({ where: { store_id: storeId } });
  await prisma.posLoyaltyEntry.deleteMany({ where: { store_id: storeId } });
  await prisma.posGameCheckout.deleteMany({ where: { store_id: storeId } });
  await prisma.posGiftCard.deleteMany({ where: { store_id: storeId } });
  await prisma.posLedgerEntry.deleteMany({ where: { store_id: storeId } });
  await prisma.posEvent.deleteMany({ where: { store_id: storeId } });
  await prisma.posCustomer.deleteMany({ where: { store_id: storeId } });
  await prisma.posInventoryItem.deleteMany({ where: { store_id: storeId } });
  await prisma.posStaff.deleteMany({ where: { store_id: storeId } });
  await prisma.posStore.delete({ where: { id: storeId } });
}

async function main() {
  const present = await existing();
  if (present && !FORCE) {
    console.log(`Store already exists (slug=${STORE_SLUG}, id=${present.id}).`);
    console.log('Run with --force to wipe and re-seed.');
    return;
  }
  if (present && FORCE) {
    console.log(`Wiping existing store (id=${present.id})...`);
    await wipe(present.id);
  }

  const owner = await findUser(BOT_EMAILS.owner);
  const manager = await findUser(BOT_EMAILS.manager);
  const cashier = await findUser(BOT_EMAILS.cashier);

  console.log('Creating store...');
  const store = await prisma.posStore.create({
    data: {
      name: STORE_NAME,
      slug: STORE_SLUG,
      owner_id: owner.id,
      address: { street: '123 Main St', city: 'South Bend', state: 'IN', zip: '46601' },
      settings: {
        onboarding_complete: true,
        currency: 'USD',
        timezone: 'America/Indiana/Indianapolis',
        store_type: 'flgs_with_cafe',
        receipt_footer: 'Thanks for playing! Find us online at afterroar.store',
        // Disable anything that hits external services in walkthrough mode.
        stripe_terminal_enabled: false,
        ai_walkthrough: true,
      },
    },
  });
  console.log('  store id:', store.id);

  console.log('Creating staff (owner/manager/cashier)...');
  await prisma.posStaff.createMany({
    data: [
      { user_id: owner.id,   store_id: store.id, role: 'owner',   name: 'Bot Owner',   active: true },
      { user_id: manager.id, store_id: store.id, role: 'manager', name: 'Bot Manager', active: true },
      { user_id: cashier.id, store_id: store.id, role: 'cashier', name: 'Bot Cashier', active: true },
    ],
  });
  const staff = await prisma.posStaff.findMany({ where: { store_id: store.id } });
  const ownerStaff   = staff.find((s) => s.role === 'owner');
  const managerStaff = staff.find((s) => s.role === 'manager');
  const cashierStaff = staff.find((s) => s.role === 'cashier');

  console.log('Seeding inventory...');
  await prisma.posInventoryItem.createMany({
    data: INVENTORY.map((it) => ({ store_id: store.id, ...it, attributes: it.attributes })),
  });
  const items = await prisma.posInventoryItem.findMany({ where: { store_id: store.id } });
  console.log(`  ${items.length} items`);

  console.log('Seeding customers...');
  const customers = [];
  for (let i = 0; i < 60; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    customers.push({
      store_id: store.id,
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@walkthrough.example`,
      phone: `574-555-${String(1000 + i).padStart(4, '0')}`,
      credit_balance_cents: i % 7 === 0 ? rand(4000) + 500 : 0,
    });
  }
  await prisma.posCustomer.createMany({ data: customers });
  const customerRows = await prisma.posCustomer.findMany({ where: { store_id: store.id }, take: 60 });
  console.log(`  ${customerRows.length} customers`);

  console.log('Seeding events...');
  const eventsData = [
    { name: 'Friday Night Magic',  event_type: 'fnm',     entry_fee_cents: 500,  max_players: 32, starts_at: daysFromNow(2) },
    { name: 'Commander Night',     event_type: 'casual',  entry_fee_cents: 0,    max_players: 24, starts_at: daysFromNow(5) },
    { name: 'Pokemon League',      event_type: 'league',  entry_fee_cents: 0,    max_players: 20, starts_at: daysAgo(7) },
    { name: 'Modern Showdown',     event_type: 'tourney', entry_fee_cents: 1500, max_players: 16, starts_at: daysAgo(14) },
  ];
  for (const e of eventsData) {
    const starts = new Date(e.starts_at); starts.setHours(18, 0, 0, 0);
    const ends = new Date(starts); ends.setHours(22, 0, 0, 0);
    await prisma.posEvent.create({
      data: { store_id: store.id, name: e.name, event_type: e.event_type, entry_fee_cents: e.entry_fee_cents, max_players: e.max_players, starts_at: starts, ends_at: ends },
    });
  }
  const events = await prisma.posEvent.findMany({ where: { store_id: store.id } });
  console.log(`  ${events.length} events (2 upcoming + 2 completed)`);

  console.log('Seeding orders + ledger entries (last 30 days)...');
  let orderNum = 1001;
  for (let i = 0; i < 50; i++) {
    const customer = customerRows[rand(customerRows.length)];
    const orderDate = daysAgo(rand(30));
    const lineItemCount = rand(4) + 1;
    let subtotal = 0;
    const lineItems = [];
    for (let j = 0; j < lineItemCount; j++) {
      const item = items[rand(items.length)];
      const qty = rand(2) + 1;
      lineItems.push({
        inventory_item_id: item.id,
        name: item.name,
        quantity: qty,
        price_cents: item.price_cents,
        total_cents: item.price_cents * qty,
      });
      subtotal += item.price_cents * qty;
    }
    const tax = Math.round(subtotal * 0.07);
    const order = await prisma.posOrder.create({
      data: {
        store_id: store.id,
        customer_id: customer.id,
        order_number: `WT-${orderNum++}`,
        source: i % 8 === 0 ? 'online' : 'pos',
        status: i % 12 === 0 ? 'cancelled' : 'delivered',
        fulfillment_status: i % 8 === 0 ? 'delivered' : 'unfulfilled',
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: subtotal + tax,
        created_at: orderDate,
        items: { create: lineItems },
      },
    });
    if (order.status !== 'cancelled') {
      await prisma.posLedgerEntry.create({
        data: {
          store_id: store.id,
          customer_id: customer.id,
          staff_id: i % 3 === 0 ? cashierStaff.id : ownerStaff.id,
          type: 'sale',
          amount_cents: subtotal + tax,
          description: `Sale ${order.order_number}`,
          created_at: orderDate,
          metadata: { order_id: order.id, payment_method: choice(['cash','credit','gift_card']) },
        },
      });
    }
  }
  const orderCount = await prisma.posOrder.count({ where: { store_id: store.id } });
  console.log(`  ${orderCount} orders`);

  console.log('Seeding cafe tabs...');
  const tabsData = [
    { table_label: 'Table 3', status: 'open',   notes: 'Drafting Modern' },
    { table_label: 'Table 5', status: 'open',   notes: 'Pokemon casual' },
    { table_label: 'Table 1', status: 'closed', notes: 'Brunch group' },
    { table_label: 'Bar',     status: 'closed', notes: 'Quick coffee' },
  ];
  for (const t of tabsData) {
    const c = customerRows[rand(customerRows.length)];
    const itemCount = rand(3) + 1;
    let subtotal = 0;
    const lineItems = [];
    for (let j = 0; j < itemCount; j++) {
      const it = items.filter((x) => x.category === 'food_drink')[rand(8)];
      const qty = rand(2) + 1;
      lineItems.push({
        inventory_item_id: it.id,
        name: it.name,
        quantity: qty,
        price_cents: it.price_cents,
        item_type: 'cafe',
      });
      subtotal += it.price_cents * qty;
    }
    await prisma.posTab.create({
      data: {
        store_id: store.id,
        customer_id: c.id,
        staff_id: t.status === 'closed' ? cashierStaff.id : null,
        table_label: t.table_label,
        status: t.status,
        subtotal_cents: subtotal,
        tax_cents: Math.round(subtotal * 0.07),
        total_cents: subtotal + Math.round(subtotal * 0.07),
        notes: t.notes,
        items: { create: lineItems },
      },
    });
  }
  console.log('  4 tabs (2 open + 2 closed)');

  console.log('Seeding tournament...');
  const tourney = await prisma.posTournament.create({
    data: {
      store_id: store.id,
      name: 'Modern Showdown — Spring',
      format: 'swiss',
      status: 'completed',
      bracket_type: 'swiss',
      max_players: 16,
      current_round: 3,
      total_rounds: 3,
    },
  });
  // 8 players
  const tourneyPlayers = [];
  for (let i = 0; i < 8; i++) {
    const c = customerRows[i * 3];
    const p = await prisma.posTournamentPlayer.create({
      data: {
        tournament_id: tourney.id,
        customer_id: c.id,
        player_name: c.name,
        seed: i + 1,
        wins: rand(4),
        losses: rand(3),
        draws: 0,
      },
    });
    tourneyPlayers.push(p);
  }
  // 3 rounds of swiss = 4 matches per round
  for (let r = 1; r <= 3; r++) {
    for (let m = 0; m < 4; m++) {
      const p1 = tourneyPlayers[m * 2];
      const p2 = tourneyPlayers[m * 2 + 1];
      const winner = rand(2) === 0 ? p1.id : p2.id;
      await prisma.posTournamentMatch.create({
        data: {
          tournament_id: tourney.id,
          round_number: r,
          match_number: m + 1,
          player1_id: p1.id,
          player2_id: p2.id,
          winner_id: winner,
          status: 'completed',
          player1_score: winner === p1.id ? 2 : rand(2),
          player2_score: winner === p2.id ? 2 : rand(2),
        },
      });
    }
  }
  console.log('  1 completed tournament with 8 players + 12 matches');

  console.log('Seeding gift cards...');
  for (let i = 0; i < 6; i++) {
    const initial = (i + 1) * 2500;
    const used = i < 3 ? rand(initial) : 0;
    await prisma.posGiftCard.create({
      data: {
        store_id: store.id,
        code: `GC-${String(1000 + i).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        initial_balance_cents: initial,
        balance_cents: initial - used,
        purchased_by_customer_id: customerRows[i * 5].id,
        active: true,
      },
    });
  }
  console.log('  6 gift cards');

  console.log('Seeding loyalty entries...');
  for (let i = 0; i < 25; i++) {
    const c = customerRows[i];
    const points = (rand(50) + 10) * 10;
    await prisma.posLoyaltyEntry.create({
      data: {
        store_id: store.id,
        customer_id: c.id,
        type: 'earn_purchase',
        points,
        balance_after: points,
        description: 'Purchase reward',
      },
    });
  }
  console.log('  25 loyalty entries');

  console.log('Seeding game library checkouts...');
  const boardGames = items.filter((x) => x.category === 'board_game');
  for (let i = 0; i < 5; i++) {
    const c = customerRows[(i + 10) * 2];
    const item = boardGames[i % boardGames.length];
    const isOpen = i < 2;
    await prisma.posGameCheckout.create({
      data: {
        store_id: store.id,
        inventory_item_id: item.id,
        customer_id: c.id,
        staff_id: cashierStaff.id,
        checked_out_at: daysAgo(isOpen ? 0 : rand(7) + 1),
        returned_at: isOpen ? null : daysAgo(rand(2)),
        fee_cents: 0,
        status: isOpen ? 'out' : 'returned',
      },
    });
  }
  console.log('  5 game checkouts (2 open + 3 returned)');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Done. Store ready for AI walkthrough.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Login at: https://www.afterroar.store/login`);
  console.log(`  Owner:    bot-owner@afterroar.store   / bot1234!`);
  console.log(`  Manager:  bot-manager@afterroar.store / bot1234!`);
  console.log(`  Cashier:  bot-cashier@afterroar.store / bot1234!`);
  console.log(`  Store:    "${STORE_NAME}" (slug: ${STORE_SLUG})`);
  console.log(`  Store id: ${store.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
