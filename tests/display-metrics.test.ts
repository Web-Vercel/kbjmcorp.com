import {expect,it} from 'vitest';
import {formatSpend,formatMicros} from '@/lib/ads/report-model';
import {displayMetrics} from '@/lib/ads/display-metrics';
it('rounds spend half-up to cents without changing exact raw formatting',()=>{expect(formatSpend('36240000')).toBe('36.24');expect(formatSpend('36244999')).toBe('36.24');expect(formatSpend('36245000')).toBe('36.25');expect(formatSpend('999999')).toBe('1.00');expect(formatSpend('90071992547409930000')).toBe('90071992547409.93');expect(formatMicros('36245000')).toBe('36.245000');});
it('computes customer metrics from advertised client charges and handles zero denominators',()=>{expect(displayMetrics('21198','1017','20')).toEqual({ctr:'1.97%',cpc:'10.60',cpm:'208.44'});expect(displayMetrics('0','0','0')).toEqual({ctr:'—',cpc:'—',cpm:'—'});});
