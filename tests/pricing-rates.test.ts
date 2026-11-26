import { expect, it } from 'vitest';
import { pricingRateInput, resolvePricingRates } from '@/lib/billing/pricing-rates';

it('inherits individual system rates and preserves a customer waiver', () => {
 const system = { revision: 1, effective_month: '2026-11-01', canada_bps: 1400, china_bps: 2100, transfer_bps: 500 };
 const customer = { revision: 2, effective_month: '2026-11-01', canada_bps: null, china_bps: 1850, transfer_bps: 0 };
 expect(resolvePricingRates(system, customer)).toEqual({ canada: 1400, china: 1850, transfer: 0 });
});

it('accepts decimal and zero rates, and permits inheritance only for customer overrides', () => {
 const input = { organizationId: 'b0000000-0000-4000-8000-000000000001', month: '2026-11', canada: '', china: '18.25', transfer: '0' };
 expect(pricingRateInput.parse(input)).toMatchObject({ canada: null, china: 1825, transfer: 0 });
 expect(pricingRateInput.safeParse({ ...input, organizationId: '' }).success).toBe(false);
 expect(pricingRateInput.safeParse({ ...input, transfer: '100.01' }).success).toBe(false);
 expect(pricingRateInput.safeParse({ ...input, month: '2026-13' }).success).toBe(false);
});
