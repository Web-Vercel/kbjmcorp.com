import { getStaffContext, staffError } from '@/lib/admin/guard';
import { authResponse, readAuthBody } from '@/lib/auth/http';
import { pricingRateInput } from '@/lib/billing/pricing-rates';

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
  });
  if (result.error) return authResponse({ error: 'save_failed' }, 502);
  return authResponse({ ok: true });
}
