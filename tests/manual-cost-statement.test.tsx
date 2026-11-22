import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {statement} from './fixtures/client-statement';
import {clientStatementSchema,type ClientStatement} from '@/lib/billing/client-statement';
import {statementCsv,statementHtml} from '@/lib/billing/statement-export';
import Performance from '@/components/billing/StatementPerformance';
const manual:ClientStatement={...statement,usage:{...statement.usage,coverage_kind:'manual_cost_only',impressions:null,clicks:null,daily:[]}};
it('represents missing manual metrics truthfully in the customer view and both exports',()=>{expect(clientStatementSchema.safeParse(manual).success).toBe(true);expect(renderToStaticMarkup(<Performance statement={manual} zh/>)).toBe('');for(const content of [statementCsv(manual,true),statementHtml(manual,true)]){expect(content).toContain('未提供');expect(content).not.toContain('null');}expect(clientStatementSchema.safeParse({...manual,usage:{...manual.usage,coverage_kind:'complete_rows'}}).success).toBe(false);});
