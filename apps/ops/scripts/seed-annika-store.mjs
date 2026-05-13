// Provision a "fully loaded" test store on Store Ops for Annika.
//
// Mirrors scripts/seed-bot-store.mjs but provisions Annika as the sole
// owner (no separate manager/cashier bot accounts). She gets a complete
// store with inventory, customers, events, orders, cafe tabs, a
// tournament, gift cards, loyalty entries, and game checkouts so she
// can exercise every Store Ops surface end-to-end.
//
// Idempotent: re-running without --force is a no-op; with --force it
// wipes and re-seeds.
//
// Usage:
//   cd c:/dev/FULL UPROAR PLATFORM/ops-afterroar-store/apps/ops
//   node scripts/seed-annika-store.mjs           # create if missing
//   node scripts/seed-annika-store.mjs --force   # wipe + reseed

import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenvConfig({ path: '.env.local' });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FORCE = process.argv.includes('--force');
const STORE_SLUG = 'annikas-test-store';
const STORE_NAME = "Annika's Test Store";
const OWNER_EMAIL = 'annika@fulluproar.com';

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
  // Sealed
  { name: 'MTG Play Booster Box - Foundations', category: 'sealed', price_cents: 12999, cost_cents: 8500, quantity: 6, attributes: { game: 'MTG', product_type: 'booster_box' } },
  { name: 'MTG Commander Deck - Pioneer', category: 'sealed', price_cents: 4499, cost_cents: 2800, quantity: 5, attributes: { game: 'MTG', product_type: 'commander_deck' } },
  { name: 'Pokemon Elite Trainer Box', category: 'sealed', price_cents: 6999, cost_cents: 4500, quantity: 4, attributes: { game: 'Pokemon', product_type: 'etb' } },
  // Board Games
  { name: 'Wingspan', category: 'board_game', price_cents: 6499, cost_cents: 3800, quantity: 3, attributes: { publisher: 'Stonemaier', players: '1-5', age: '10+' } },
  { name: 'Catan', category: 'board_game', price_cents: 4499, cost_cents: 2500, quantity: 4, attributes: { publisher: 'Catan Studio', players: '3-4', age: '10+' } },
  { name: 'Ticket to Ride', category: 'board_game', price_cents: 4499, cost_cents: 2500, quantity: 3, attributes: { publisher: 'Days of Wonder', players: '2-5', age: '8+' } },
  { name: 'Spirit Island', category: 'board_game', price_cents: 7999, cost_cents: 4800, quantity: 2, attributes: { publisher: 'Greater Than Games', players: '1-4', age: '13+' } },
  { name: 'Cascadia', category: 'board_game', price_cents: 3999, cost_cents: 2300, quantity: 4, attributes: { publisher: 'Flatout Games', players: '1-4', age: '10+' } },
  // Accessories
  { name: 'Dragon Shield Sleeves (100ct, Matte Black)', category: 'accessory', price_cents: 1199, cost_cents: 600, quantity: 20, attributes: { type: 'sleeves' } },
  { name: 'Ultra Pro Deck Box', category: 'accessory', price_cents: 499, cost_cents: 200, quantity: 15, attributes: { type: 'deck_box' } },
  { name: 'Chessex 7-Die Set (Black)', category: 'accessory', price_cents: 999, cost_cents: 400, quantity: 10, attributes: { type: 'dice' } },
  { name: 'Playmat - Forest', category: 'accessory', price_cents: 2499, cost_cents: 1200, quantity: 5, attributes: { type: 'playmat' } },
  // Food & Drink
  { name: 'Drip Coffee', category: 'food_drink', price_cents: 300, cost_cents: 50, quantity: 999, attributes: { type: 'hot_drink' } },
  { name: 'Latte', category: 'food_drink', price_cents: 500, cost_cents: 100, quantity: 999, attributes: { type: 'hot_drink' } },
  { name: 'Iced Coffee', category: 'food_drink', price_cents: 400, cost_cents: 80, quantity: 999, attributes: { type: 'cold_drink' } },
  { name: 'Soda Can', category: 'food_drink', price_cents: 200, cost_cents: 60, quantity: 60, attributes: { type: 'cold_drink' } },
  { name: 'Bottled Water', category: 'food_drink', price_cents: 150, cost_cents: 40, quantity: 80, attributes: { type: 'cold_drink' } },
  { name: 'Snickers Bar', category: 'food_drink', price_cents: 200, cost_cents: 70, quantity: 30, attributes: { type: 'snack' } },
  { name: 'Pizza Slice', category: 'food_drink', price_cents: 599, cost_cents: 200, quantity: 999, attributes: { type: 'hot_food' } },
];

const FIRST_NAMES = ['Liam','Noah','Oliver','Emma','Olivia','Charlotte','Amelia','James','Sophia','Lucas','Henry','Benjamin','Theodore','Mia','Isabella','Evelyn','Harper','Luna','Camila','Elizabeth','Jack','Mason','Ethan','Alexander','Daniel','Hazel','Violet','Aurora','Bella','Skylar','Zoe','Maya','Logan','Sebastian','Owen','Wyatt','Penelope','Layla','Riley','Nora','Lily','Aria','Mila','Avery','Audrey','Brooklyn','Claire','Ella'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott'];

function rand(n) { return Math.floor(Math.random() * n); }
function choice(arr) { return arr[rand(arr.length)]; }
function daysAgo(d) { const x = new Date(); x.setDate(x.getDate() - d); return x; }
function daysFromNow(d) { const x = new Date(); x.setDate(x.getDate() + d); return x; }

async function wipe(storeId) {
  await prisma.posOrderItem.deleteMany({ where: { order: { store_id: storeId } } });
  await prisma.posOrder.deleteMany({ where: { store_id: storeId } });
  await prisma.posTournamentMatch.deleteMany({ where: { tournament: { store_id: storeId } } });
  await prisma.posTournamentPlayer.deleteMany({ where: { tournament: { store_id: storeId } } });
  await prisma.posTournament.deleteMany({ where: { store_id: storeId } });
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
  const present = await prisma.posStore.findUnique({ where: { slug: STORE_SLUG } });
  if (present && !FORCE) {
    console.log(`Store already exists (slug=${STORE_SLUG}, id=${present.id}).`);
    console.log('Run with --force to wipe and re-seed.');
    return;
  }
  if (present && FORCE) {
    console.log(`Wiping existing store (id=${present.id})...`);
    await wipe(present.id);
  }

  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) throw new Error(`User not found: ${OWNER_EMAIL}`);

  console.log('Creating store...');
  const store = await prisma.posStore.create({
    data: {
      name: STORE_NAME,
      slug: STORE_SLUG,
      owner_id: owner.id,
      address: { street: '742 Test Lane', city: 'South Bend', state: 'IN', zip: '46601' },
      settings: {
        onboarding_complete: true,
        currency: 'USD',
        timezone: 'America/Indiana/Indianapolis',
        store_type: 'flgs_with_cafe',
        receipt_footer: "Thanks for testing! — Annika's Test Store",
        stripe_terminal_enabled: false,
      },
    },
  });
  console.log('  store id:', store.id);

  console.log('Creating staff (owner)...');
  const ownerStaff = await prisma.posStaff.create({
    data: { user_id: owner.id, store_id: store.id, role: 'owner', name: 'Annika', active: true },
  });

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
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@annika.test`,
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
  console.log(`  ${events.length} events (2 upcoming + 2 past)`);

  console.log('Seeding orders + ledger entries...');
  let orderNum = 2001;
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
        order_number: `ATS-${orderNum++}`,
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
          staff_id: ownerStaff.id,
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
    const foodItems = items.filter((x) => x.category === 'food_drink');
    for (let j = 0; j < itemCount; j++) {
      const it = foodItems[rand(foodItems.length)];
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
        staff_id: t.status === 'closed' ? ownerStaff.id : null,
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
  console.log('  4 cafe tabs (2 open + 2 closed)');

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
  console.log('  1 tournament, 8 players, 12 matches');

  console.log('Seeding gift cards...');
  for (let i = 0; i < 6; i++) {
    const initial = (i + 1) * 2500;
    const used = i < 3 ? rand(initial) : 0;
    await prisma.posGiftCard.create({
      data: {
        store_id: store.id,
        code: `GC-${String(2000 + i).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
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

  console.log('Seeding game checkouts...');
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
        staff_id: ownerStaff.id,
        checked_out_at: daysAgo(isOpen ? 0 : rand(7) + 1),
        returned_at: isOpen ? null : daysAgo(rand(2)),
        fee_cents: 0,
        status: isOpen ? 'out' : 'returned',
      },
    });
  }
  console.log('  5 game checkouts (2 open + 3 returned)');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log("  Done. Annika's Test Store is ready.");
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Login at:  https://www.afterroar.store/login`);
  console.log(`  Owner:     ${OWNER_EMAIL} (Google sign-in)`);
  console.log(`  Store:     "${STORE_NAME}" (slug: ${STORE_SLUG})`);
  console.log(`  Store id:  ${store.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
