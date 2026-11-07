import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingData } from "./model";
export const reportColumns = "id,wallet_id,organization_id,month,version,currency,ad_spend_minor,service_fee_minor,source_language,translation_status,source_filename,source_account_name,source_timezone,published_at,summary_zh,summary_en,source_currency,source_ad_spend_minor,settlement_date,fee_basis_points,fee_agreement_reference";
export async function loadBilling(client: SupabaseClient): Promise<BillingData> {
 const empty = { wallets: [], entries: [], topups: [], reports: [], error: true };
 const wallets = await client.rpc("get_client_wallets");
 if (wallets.error) return empty;
 if (!wallets.data?.length) return { ...empty, error: false };
 const ids = wallets.data.map((wallet: { id: string }) => wallet.id);
 const [entries, topups, reports] = await Promise.all([
  client.from("wallet_entries").select("id,wallet_id,kind,amount_minor,description,posted_at").in("wallet_id", ids).order("posted_at", { ascending: false }).limit(100),
  client.from("client_topups").select("id,wallet_id,amount_minor,reference,status,created_at").in("wallet_id", ids).order("created_at", { ascending: false }).limit(100),
  client.from("monthly_ad_reports").select(reportColumns).in("wallet_id", ids).order("month", { ascending: false }).limit(100),
 ]);
 if (entries.error || topups.error || reports.error) return empty;
 // PostgREST JSON numbers cannot represent arbitrary bigint values exactly.
 // Individual entries are capped at 9,999,999,999 minor units by SQL; aggregate
 // balances are returned as decimal text by get_client_wallets().
 return { error: false, wallets: wallets.data, entries: entries.data.map(e => ({ ...e, amount_minor: String(e.amount_minor) })), topups: topups.data.map(t => ({ ...t, amount_minor: String(t.amount_minor) })), reports: reports.data.map(r => ({ ...r, ad_spend_minor: String(r.ad_spend_minor), service_fee_minor: String(r.service_fee_minor), fx: null, source_ad_spend_minor: r.source_ad_spend_minor == null ? null : String(r.source_ad_spend_minor) })) } as BillingData;
}
