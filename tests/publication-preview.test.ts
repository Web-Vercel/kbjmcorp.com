import {it,expect} from 'vitest';
import {publicationPreview} from '@/lib/operations/publication-preview';
const id=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const data={organization_id:id(1),month:'2024-01-01',wallet_id:id(2),balance_minor:'60000',accounts:[{binding_id:id(3),stage:'publication_ready',source_ready:true,draft_id:id(4),draft_status:'approved',draft_total_cny_minor:'40000',statement_id:null}]};
const scope={organizationId:id(1),month:'2024-01-01',draftId:id(4),amountMinor:'40000'};
it('provides exact CNY before/charge/after amounts only for the matching current reviewed draft',()=>{
 expect(publicationPreview(data,scope)).toEqual({wallet_open:true,balance_minor:'60000',charge_minor:'40000',remaining_minor:'20000'});expect(publicationPreview({...data,balance_minor:'20000'},scope)?.remaining_minor).toBe('-20000');expect(publicationPreview({...data,balance_minor:'9007199254740993'},scope)?.remaining_minor).toBe('9007199254700993');
});
it('does not infer zero from a missing wallet, wrong scope, another revision or a mismatched amount',()=>{
 expect(publicationPreview({...data,wallet_id:null},scope)).toEqual({wallet_open:false,balance_minor:null,charge_minor:'40000',remaining_minor:null});expect(publicationPreview(data,{...scope,amountMinor:'1'})).toBeNull();expect(publicationPreview(data,{...scope,draftId:id(8)})).toBeNull();expect(publicationPreview(data,{...scope,organizationId:id(9)})).toBeNull();expect(publicationPreview(null,scope)).toBeNull();
});
