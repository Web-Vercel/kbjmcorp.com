import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Checks from '@/components/partners/RefundChecks';
import type {RefundWorkspace} from '@/lib/partners/model';
const base:RefundWorkspace={wallets:[],payments:[],staff:true,owner:false,refunds:[{id:'test',company:'TEST COMPANY',gross_minor:'2000',fee_minor:'100',net_minor:'1900',status:'requested',wallet_id:'wallet',organization_id:'org',policy_snapshot:{mode:'fixed',value:100,agreement:'TEST'},reason:'TEST ONLY',review_note:null,assessment:null,prepared_by_me:null,requested_by_me:false,created_at:'2026-11-18T23:00:00Z',paid_at:null}]};
it('does not repeat ordinary pending applications above their processing area',()=>{expect(renderToStaticMarkup(<Checks data={base}/>)).toBe('');});
it('keeps real amount inconsistencies and incomplete-data alerts visible',()=>{const html=renderToStaticMarkup(<Checks data={{...base,refunds:[{...base.refunds[0],net_minor:'1800'}]}}/>);expect(html).toContain('退款记录需核实');expect(html).toContain('申请金额与手续费、实退金额不一致');expect(html).not.toContain('退款待办与核对');const limit=renderToStaticMarkup(<Checks data={{...base,refunds:Array.from({length:200},(_,i)=>({...base.refunds[0],id:String(i)}))}}/>);expect(limit).toContain('记录达到显示上限');});
