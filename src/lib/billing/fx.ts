/** CAD cents -> CNY cents. Rates are decimal text; calculations never use floats. */
const SCALE = 100000000n;
export const SERVICE_FEE_BPS = 0;
export function rateUnits(rate: string): bigint {
 if (!/^\d{1,6}(\.\d{1,8})?$/.test(rate)) throw new Error("Invalid CAD/CNY quote");
 const [whole, fraction = ""] = rate.split(".");
 const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, "0"));
 if (units <= 0n) throw new Error("Missing positive CAD/CNY quote");
 return units;
}
function minor(value: string) { if (!/^\d+$/.test(value)) throw new Error("Invalid source amount"); return BigInt(value); }
export function roundHalfUp(numerator: bigint, denominator: bigint) { if (numerator < 0n || denominator <= 0n) throw new Error("Invalid rounding input"); return (numerator + denominator / 2n) / denominator; }
export function cadSettlement(sourceCadMinor: string, rate: string, feeBps = SERVICE_FEE_BPS) {
 if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) throw new Error("Invalid agreed fee");
 const adSpend = roundHalfUp(minor(sourceCadMinor) * rateUnits(rate), SCALE);
 const fee = roundHalfUp(adSpend * BigInt(feeBps), 10000n);
 return { adSpendMinor: adSpend.toString(), feeMinor: fee.toString(), totalMinor: (adSpend + fee).toString() };
}
/** Largest-remainder allocation makes displayed lines sum to the rounded invoice total. */
export function allocateConvertedLines(sourceMinor: string[], rate: string): string[] {
 if (!sourceMinor.length) return [];
 const units = rateUnits(rate); const values = sourceMinor.map(minor);
 const total = roundHalfUp(values.reduce((sum, value) => sum + value, 0n) * units, SCALE);
 const lines = values.map((value, index) => ({ index, cents: value * units / SCALE, remainder: value * units % SCALE }));
 let extra = total - lines.reduce((sum, line) => sum + line.cents, 0n);
 const order = [...lines].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
 for (const line of order) { if (!extra) break; line.cents += 1n; extra -= 1n; }
 return lines.map(line => line.cents.toString());
}
