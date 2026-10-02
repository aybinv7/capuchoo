import type { Transaction } from "kysely";
import type { Database } from "../db/schema";
import type { Dice } from "./dice";

export type PersonKey = "owner" | "karim" | "ines" | "omar" | "lea";

/** What every part of the demo writes with: one transaction, one clock, one dice. */
export interface DemoContext {
  trx: Transaction<Database>;
  now: Date;
  dice: Dice;
  organizationId: string;
  people: Record<PersonKey, string>;
}

export const ago = (context: Pick<DemoContext, "now">, ms: number): Date =>
  new Date(context.now.getTime() - ms);

export const after = (from: Date, ms: number): Date => new Date(from.getTime() + ms);
