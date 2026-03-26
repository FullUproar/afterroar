export type PaymentMethod = "cash" | "card" | "store_credit" | "split";

export interface PaymentResult {
  success: boolean;
  transaction_id: string;
  method: PaymentMethod;
  error?: string;
}

export interface PaymentProvider {
  charge(amount_cents: number): Promise<PaymentResult>;
  name: string;
}

function generateTransactionId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

/* ------------------------------------------------------------------ */
/*  Cash — always succeeds immediately                                */
/* ------------------------------------------------------------------ */
export class CashPaymentProvider implements PaymentProvider {
  name = "cash";

  async charge(amount_cents: number): Promise<PaymentResult> {
    return {
      success: true,
      transaction_id: generateTransactionId("CASH"),
      method: "cash",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Simulated Card — succeeds after a short delay                     */
/* ------------------------------------------------------------------ */
export class SimulatedCardProvider implements PaymentProvider {
  name = "card";

  async charge(amount_cents: number): Promise<PaymentResult> {
    await new Promise((r) => setTimeout(r, 500));
    return {
      success: true,
      transaction_id: generateTransactionId("CARD"),
      method: "card",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Store Credit — checks balance, returns success/fail               */
/*  (actual DB deduction happens in the API route)                    */
/* ------------------------------------------------------------------ */
export class StoreCreditProvider implements PaymentProvider {
  name = "store_credit";
  private balance_cents: number;

  constructor(customer_credit_balance_cents: number) {
    this.balance_cents = customer_credit_balance_cents;
  }

  async charge(amount_cents: number): Promise<PaymentResult> {
    if (amount_cents > this.balance_cents) {
      return {
        success: false,
        transaction_id: "",
        method: "store_credit",
        error: `Insufficient store credit. Balance: ${this.balance_cents}, required: ${amount_cents}`,
      };
    }
    return {
      success: true,
      transaction_id: generateTransactionId("CREDIT"),
      method: "store_credit",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  processPayment — top-level helper                                 */
/* ------------------------------------------------------------------ */
export async function processPayment(
  method: PaymentMethod,
  amount_cents: number,
  customer_credit_balance_cents?: number
): Promise<PaymentResult> {
  let provider: PaymentProvider;

  switch (method) {
    case "cash":
      provider = new CashPaymentProvider();
      break;
    case "card":
      provider = new SimulatedCardProvider();
      break;
    case "store_credit":
      provider = new StoreCreditProvider(customer_credit_balance_cents ?? 0);
      break;
    case "split":
      // For split payments the API route handles the two legs separately;
      // this just validates the card portion succeeds.
      provider = new SimulatedCardProvider();
      break;
    default:
      return {
        success: false,
        transaction_id: "",
        method,
        error: `Unknown payment method: ${method}`,
      };
  }

  return provider.charge(amount_cents);
}
