import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ServiceStatus from '@/components/operations/ServiceStatus';
it.each([['open','待处理'],['in_progress','处理中'],['resolved','已解决']])('shows %s with a consistent state marker and readable text', (status,label)=>{const html=renderToStaticMarkup(<ServiceStatus status={status} locale="zh"/>);expect(html).toContain(`data-service-status="${status}"`);expect(html).toContain(`aria-label="工单状态：${label}"`);expect(html).toContain('aria-hidden="true"');});
it('does not present an unknown status as completed',()=>{const html=renderToStaticMarkup(<ServiceStatus status="unexpected" locale="zh"/>);expect(html).toContain('状态待核查');expect(html).toContain('data-service-status="unknown"');expect(html).not.toContain('已解决');expect(renderToStaticMarkup(<ServiceStatus status="resolved" locale="en"/>)).toContain('Resolved');});
