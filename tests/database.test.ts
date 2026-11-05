import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const unlinked = "33333333-3333-4333-8333-333333333333";
const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    insert into auth.users values('${alice}'),('${bob}'),('${unlinked}');`);
  await db.exec(await readFile(new URL("../supabase/migrations/001_initial.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/002_auth_rate_limits.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/003_inquiry_contacts.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/004_global_inquiry_market.sql", import.meta.url), "utf8"));
  await db.exec(`insert into public.organizations(id,name) values('${orgA}','Client A'),('${orgB}','Client B');
    insert into public.memberships values('${orgA}','${alice}','viewer'),('${orgB}','${bob}','owner');
    insert into public.ad_accounts(id,organization_id,platform,external_id) values
      ('aaaaaaaa-1111-4111-8111-111111111111','${orgA}','search','A'),('bbbbbbbb-1111-4111-8111-111111111111','${orgB}','search','B');
    insert into public.campaigns(id,organization_id,ad_account_id,external_id,name) values
      ('aaaaaaaa-2222-4222-8222-222222222222','${orgA}','aaaaaaaa-1111-4111-8111-111111111111','a','Campaign A'),
      ('bbbbbbbb-2222-4222-8222-222222222222','${orgB}','bbbbbbbb-1111-4111-8111-111111111111','b','Campaign B');
    insert into public.campaign_metrics_daily(organization_id,campaign_id,day,currency) values
      ('${orgA}','aaaaaaaa-2222-4222-8222-222222222222','2026-01-01','USD'),
      ('${orgB}','bbbbbbbb-2222-4222-8222-222222222222','2026-01-01','USD');`);
}, 30000);
afterAll(async () => { await db?.close(); });
async function asUser<T>(id: string, query: string) {
  return db.transaction(async tx => { await tx.exec(`set local role authenticated; set local request.jwt.claim.sub='${id}';`); return tx.query<T>(query); });
}
describe("Executed PostgreSQL RLS policies", () => {
  it("shows only each user's own company and reporting rows", async () => {
    for (const [id, org] of [[alice, orgA], [bob, orgB]]) {
      for (const table of ["organizations", "memberships", "ad_accounts", "campaigns", "campaign_metrics_daily"]) {
        const column = table === "organizations" ? "id" : "organization_id";
        const result = await asUser<{ org: string }>(id, `select ${column} as org from public.${table}`);
        expect(result.rows).toEqual([{ org }]);
      }
    }
  });
  it("a newly verified user without membership sees no companies", async () => {
    expect((await asUser(unlinked, "select * from public.organizations")).rows).toEqual([]);
    expect((await asUser(unlinked, "select * from public.campaign_metrics_daily")).rows).toEqual([]);
  });
  it("clients cannot read internal CRM or grant themselves membership", async () => {
    await expect(asUser(alice, "select * from public.crm_contacts")).rejects.toThrow(/permission denied/);
    await expect(asUser(alice, `insert into public.memberships values('${orgB}','${alice}','owner')`)).rejects.toThrow(/permission denied/);
  });
  it("anonymous users cannot read business records", async () => {
    await expect(db.transaction(async tx => { await tx.exec("set local role anon"); return tx.query("select * from public.inquiries"); })).rejects.toThrow(/permission denied/);
  });
  it("rejects campaign links across organizations even for privileged writers", async () => {
    await expect(db.exec(`insert into public.campaigns(organization_id,ad_account_id,external_id,name) values('${orgB}','aaaaaaaa-1111-4111-8111-111111111111','invalid','Invalid')`)).rejects.toThrow(/foreign key/);
  });
});
describe("Executed atomic database rate limits", () => {
  it("permits first request then rejects repeat without partially consuming other buckets", async () => {
    const call = "select public.consume_auth_limits(array['test:phone','test:global'],array[1,5],array[60,600]) as wait";
    expect((await db.query<{ wait: number }>(call)).rows[0].wait).toBe(0);
    expect((await db.query<{ wait: number }>(call)).rows[0].wait).toBeGreaterThan(0);
    const rows = await db.query<{ attempts: number }>("select attempts from public.auth_rate_limits where bucket='test:global'");
    expect(rows.rows[0].attempts).toBe(1);
  });
  it("allows another request after the stored window expires", async () => {
    await db.exec("update public.auth_rate_limits set window_start=0 where bucket='test:phone'");
    const result = await db.query<{ wait: number }>("select public.consume_auth_limits(array['test:phone'],array[1],array[60]) as wait");
    expect(result.rows[0].wait).toBe(0);
  });
  it("prevents browser callers from invoking the privileged limiter", async () => {
    await expect(asUser(alice, "select public.consume_auth_limits(array['attack'],array[100],array[60])")).rejects.toThrow(/permission denied/);
  });
  it("allows service-role use with RLS enabled", async () => {
    const result = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{ wait: number }>("select public.consume_auth_limits(array['service:test'],array[1],array[60]) as wait");
    });
    expect(result.rows[0].wait).toBe(0);
  });
});

describe("Executed phone-or-email inquiry constraints", () => {
  it("accepts a phone-only lead without creating an Auth account", async () => {
    await db.exec("insert into public.inquiries(company,phone_e164,message,locale,consent_at,consent_version) values('Phone Client','+8613800138000','Mainland phone inquiry test','zh',now(),'inquiry-v2')");
    const result = await db.query<{ email: string | null; phone_e164: string }>("select email,phone_e164 from public.inquiries where company='Phone Client'");
    expect(result.rows).toEqual([{ email: null, phone_e164: "+8613800138000" }]);
    expect((await db.query<{ count: number }>("select count(*)::integer as count from auth.users")).rows[0].count).toBe(3);
  });
  it("rejects missing contact methods and malformed international phone numbers", async () => {
    await expect(db.exec("insert into public.inquiries(company,message,locale,consent_at,consent_version) values('No Contact','Missing contact details test','zh',now(),'inquiry-v2')")).rejects.toThrow(/check constraint/);
    await expect(db.exec("insert into public.inquiries(company,phone_e164,message,locale,consent_at,consent_version) values('Bad Phone','123','Invalid contact phone test','zh',now(),'inquiry-v2')")).rejects.toThrow(/check constraint/);
  });
});

it("persists the Global market option with the executed database constraint", async () => {
  await db.exec("insert into public.inquiries(company,email,message,locale,consent_at,consent_version,target_market) values('Global Client','global@example.com','Global brand growth inquiry','en',now(),'inquiry-v2','global')");
  const result = await db.query<{ target_market: string }>("select target_market from public.inquiries where company='Global Client'");
  expect(result.rows).toEqual([{ target_market: "global" }]);
});
