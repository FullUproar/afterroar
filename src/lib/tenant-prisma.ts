import { prisma } from "./prisma";

/* ------------------------------------------------------------------ */
/*  Tenant-Scoped Prisma Client                                        */
/*  Uses Prisma Client Extensions to auto-inject store_id on all       */
/*  pos_* model queries. This is the structural defense layer —        */
/*  even if a route forgets to add store_id, queries are scoped.       */
/* ------------------------------------------------------------------ */

// Models that have a direct store_id column
const TENANT_MODELS = [
  "posStore",
  "posStaff",
  "posCustomer",
  "posInventoryItem",
  "posSupplier",
  "posEvent",
  "posLedgerEntry",
  "posTradeIn",
  "posReturn",
  "posGiftCard",
  "posLocation",
  "posInventoryLevel",
  "posTransfer",
  "posPreorder",
  "posPromotion",
  "posLoyaltyEntry",
  "posImportJob",
  "posCertification",
  "posGameCheckout",
] as const;

type TenantModel = (typeof TENANT_MODELS)[number];

function isTenantModel(model: string | undefined): model is TenantModel {
  return TENANT_MODELS.includes(model as TenantModel);
}

export type TenantPrismaClient = ReturnType<typeof getTenantClient>;

/**
 * Returns a Prisma client that automatically scopes all pos_* queries
 * to the given store_id. Child models (PosEventCheckin, PosTradeInItem,
 * PosReturnItem) are scoped through their parent FK relationships.
 */
export function getTenantClient(storeId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, store_id: storeId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, store_id: storeId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          // findUnique requires exact unique fields — we can't inject store_id
          // into the where clause for unique queries. Instead, we verify after.
          const result = await query(args);
          if (isTenantModel(model) && result) {
            const record = result as Record<string, unknown>;
            if (record.store_id && record.store_id !== storeId) {
              return null; // Silently hide cross-tenant records
            }
          }
          return result;
        },
        async count({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, store_id: storeId };
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, store_id: storeId };
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (isTenantModel(model) && model !== "posStore") {
            const data = args.data as Record<string, unknown>;
            if (!data.store_id) {
              data.store_id = storeId;
            }
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (isTenantModel(model) && model !== "posStore") {
            const dataArray = Array.isArray(args.data) ? args.data : [args.data];
            for (const item of dataArray) {
              const record = item as Record<string, unknown>;
              if (!record.store_id) {
                record.store_id = storeId;
              }
            }
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (isTenantModel(model)) {
            const where = args.where as Record<string, unknown>;
            where.store_id = storeId;
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, store_id: storeId };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (isTenantModel(model)) {
            const where = args.where as Record<string, unknown>;
            where.store_id = storeId;
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = { ...args.where, store_id: storeId };
          }
          return query(args);
        },
      },
    },
  });
}
