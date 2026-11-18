import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import FileVisibility from './FileVisibility';
import styles from './PartnerWorkspace.module.css';
type FileRecord={id:string;name:string;kind:'agreement'|'referral';size_bytes:number;created_at:string;sha256:string};
export default async function PartnerFileList({client,files}:{client:SupabaseClient;files:FileRecord[]}){
 const result=await client.rpc('read_partner_file_visibility');
 const parsed=z.array(z.object({file_id:z.uuid(),hidden:z.boolean(),reason:z.enum(['mistake','replaced','restore'])})).safeParse(result.data);
 const ready=!result.error&&parsed.success,states=new Map(ready?parsed.data.map(s=>[s.file_id,s]):[]);
 const render=(f:FileRecord,hidden:boolean)=><article className="admin-panel" key={f.id}><h2><span className={styles.value}>{f.name}</span></h2><p>{f.kind==='agreement'?'代理合作协议':'客户引荐／归属依据'} · {(f.size_bytes/1024).toFixed(1)} KB · {f.created_at.slice(0,10)}{hidden?states.get(f.id)?.reason==='replaced'?' · 已替换':' · 已移除':''}</p><a className="service-link" href={`/api/partner-files?id=${f.id}`}>打开私密文件</a>{ready&&<FileVisibility key={`${f.id}-${hidden}`} fileId={f.id} hidden={hidden}/>}<details><summary>文件版本参考</summary><p>编号：{f.id}<br/>指纹：{f.sha256}</p></details></article>;
 const active=files.filter(f=>!states.get(f.id)?.hidden),history=files.filter(f=>states.get(f.id)?.hidden);
 return <>{!ready&&<p role="alert">文件管理状态暂不可用；以下显示已保存文件，暂不能移除或恢复。</p>}{ready&&!active.length&&<p>暂无当前文件。</p>}{active.map(f=>render(f,false))}{!!history.length&&<details className="admin-panel"><summary>历史文件 · {history.length}</summary>{history.map(f=>render(f,true))}</details>}</>;
}
