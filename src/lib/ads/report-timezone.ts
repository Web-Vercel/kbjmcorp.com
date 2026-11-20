/** Timezones may differ by name while describing identical reporting-day boundaries. */
export function canonicalReportingTimezone(value: string): string | null {
  if (value.length > 100) return null;
  try { return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone; }
  catch { return null; }
}
export function diagnosticTimezone(value: string) { return canonicalReportingTimezone(value) || 'unrecognized'; }
