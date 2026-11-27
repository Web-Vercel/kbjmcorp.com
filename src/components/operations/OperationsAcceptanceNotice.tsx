'use client';
import {usePathname} from 'next/navigation';
export default function OperationsAcceptanceNotice({locale}:{locale:'zh'|'en'}){
 const path=usePathname();
 if(path?.replace(/\/$/,'').endsWith('/operations/pricing'))return null;
 return <aside className="admin-notice" style={{margin:'1rem'}} role="note">{locale==='zh'?'财务流程验收：仅使用专用测试企业及不可付款收款资料，不实际收付款。真实广告来源仅作核对；测试余额、流水与账单不得迁入正式账本。':'Financial acceptance: use the dedicated test company and nonpayable collection details only. Do not make actual payments. Real advertising sources are for verification; never migrate test balances, entries or statements into the live ledger.'}</aside>;
}
