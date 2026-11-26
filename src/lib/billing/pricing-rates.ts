import { z } from 'zod';

export const pricingDefaults = { canada: 1500, china: 2000, transfer: 500 };
export type PricingRates = typeof pricingDefaults;
const percent = z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/)
  .transform(value => {
    const [whole, fraction = ''] = value.split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  })
  .pipe(z.number().int().min(0).max(10000));

export const pricingRateInput = z.object({
  organizationId: z.union([z.uuid(), z.literal('')]),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(month => month >= '2000-01'),
  canada: z.union([percent, z.literal('').transform(() => null)]),
  china: z.union([percent, z.literal('').transform(() => null)]),
  transfer: z.union([percent, z.literal('').transform(() => null)]),
}).refine(value => value.organizationId || [value.canada, value.china, value.transfer].every(rate => rate !== null));

export type PricingRateRow = {
  revision: number;
  effective_month: string;
  canada_bps: number | null;
  china_bps: number | null;
  transfer_bps: number | null;
};

export function resolvePricingRates(system?: PricingRateRow, customer?: PricingRateRow): PricingRates {
  return {
    canada: customer?.canada_bps ?? system?.canada_bps ?? pricingDefaults.canada,
    china: customer?.china_bps ?? system?.china_bps ?? pricingDefaults.china,
    transfer: customer?.transfer_bps ?? system?.transfer_bps ?? pricingDefaults.transfer,
  };
}

export const savedPricingRate = z.object({revision:z.number().int().positive(),organization_id:z.uuid().nullable(),effective_month:z.iso.date(),canada_bps:z.number().int().min(0).max(10000).nullable(),china_bps:z.number().int().min(0).max(10000).nullable(),transfer_bps:z.number().int().min(0).max(10000).nullable()});
