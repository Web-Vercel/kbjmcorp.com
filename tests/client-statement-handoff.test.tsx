// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {statementAcknowledgement,clientStatementPath} from '@/lib/operations/client-statement-handoff';
import AccessLink from '@/components/operations/StatementAccessLink';
import Handoff from '@/components/operations/ClientStatementHandoff';
const id='b0000000-0000-4000-8000-000000000001',other='b0000000-0000-4000-8000-000000000002';
const row={statement_id:id,confirmation_count:1,last_confirmed_at:'2026-11-01T00:00:00Z'};
const data={statement_count:1,statements:[row]};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('matches the exact statement and rejects missing, duplicate, truncated and contradictory evidence',()=>{
 expect(statementAcknowledgement(data,id).state).toBe('acknowledged');expect(statementAcknowledgement(data,other).state).toBe('unknown');
 for(const input of [null,{...data,statement_count:2},{statement_count:2,statements:[row,row]},{...data,statements:[{...row,confirmation_count:0}]},{...data,statements:[{...row,last_confirmed_at:null}]}])expect(statementAcknowledgement(input,id).state).toBe('unknown');
 expect(statementAcknowledgement({...data,statements:[{...row,confirmation_count:0,last_confirmed_at:null}]},id).state).toBe('pending');
});
it('copies only the current-origin client statement URL without sending messages or calling an API',async()=>{
 const write=vi.fn().mockResolvedValue(undefined),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);vi.stubGlobal('navigator',{clipboard:{writeText:write}});
 render(<AccessLink statementId={id} locale="zh"/>);fireEvent.click(screen.getByRole('button',{name:'复制此账单的客户链接'}));await screen.findByText('链接已复制，尚未发送给客户。');
 expect(write).toHaveBeenCalledWith(`${window.location.origin}/zh/account/statements?statement=${id}#statement-${id}`);expect(fetcher).not.toHaveBeenCalled();expect(screen.getByText(/仍须具备该企业/)).toBeDefined();
});
it('offers manual selection when clipboard access is denied and never reports success',async()=>{
 vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('PRIVATE ERROR'))}});render(<AccessLink statementId={id} locale="en"/>);fireEvent.click(screen.getByRole('button'));await screen.findByText(/Automatic copy unavailable/);expect(screen.queryByText(/Link copied/)).toBeNull();const input=screen.getByLabelText('Client statement access link') as HTMLInputElement;expect(input.selectionEnd).toBe(input.value.length);expect(screen.queryByText(/PRIVATE ERROR/)).toBeNull();
});
it('rejects malformed identifiers and never passes internal pricing in the URL',()=>{
 expect(clientStatementPath('invalid','zh')).toBeNull();expect(clientStatementPath(id,'en')).toBe(`/en/account/statements?statement=${id}#statement-${id}`);render(<AccessLink statementId="invalid" locale="zh"/>);expect(screen.queryByRole('button')).toBeNull();
});
it('shows per-statement acknowledgement without implying fee acceptance or every member has read it',()=>{
 render(<Handoff statementId={id} readStatus={{...data,privateFX:'PRIVATE FX',phone:'PRIVATE PHONE'}} locale="zh"/>);expect(screen.getByText(/已有客户提交此账单/)).toBeDefined();expect(screen.getByText(/不代表同意收费/)).toBeDefined();expect(screen.queryByText(/PRIVATE FX|PRIVATE PHONE/)).toBeNull();expect(screen.queryByRole('checkbox')).toBeNull();
});
