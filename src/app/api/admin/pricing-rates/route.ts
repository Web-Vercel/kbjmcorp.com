import { getStaffContext, staffError } from '@/lib/admin/guard';
import { authResponse, readAuthBody } from '@/lib/auth/http';
import { pricingRateInput, savedPricingRate } from '@/lib/billing/pricing-rates';

export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (input.error) return input.error;
  const parsed = pricingRateInput.safeParse(input.body);
  if (!parsed.success) return authResponse({ error: 'invalid_input' }, 400);
  const staff = await getStaffContext();
  if ('error' in staff) return staffError(staff);
  if (staff.role !== 'admin') return authResponse({ error: 'forbidden' }, 403);

  const { organizationId, month, canada, china, transfer } = parsed.data;
  const result = await staff.client.from('monthly_pricing_rates').insert({
    organization_id: organizationId || null,
    effective_month: month + '-01',
    canada_bps: canada,
    china_bps: china,
    transfer_bps: transfer,
  }).select('revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps').single();
  if (result.error) return authResponse({ error: 'save_failed' }, 502);
  const saved=savedPricingRate.safeParse(result.data);
  if(!saved.success||saved.data.organization_id!==(organizationId||null)||saved.data.effective_month!==month+'-01'||saved.data.canada_bps!==canada||saved.data.china_bps!==china||saved.data.transfer_bps!==transfer)return authResponse({error:'save_unconfirmed'},502);
  return authResponse({ ok: true, saved:saved.data });
}
