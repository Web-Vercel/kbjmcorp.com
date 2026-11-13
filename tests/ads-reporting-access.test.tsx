import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({operations:vi.fn(),config:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));
vi.mock('@/lib/ads/report-client',()=>({reportingConfig:m.config,reportingDiagnostics:()=>[]}));
import Page from '@/app/[locale]/operations/ads-reporting/page';
beforeEach(()=>{vi.clearAllMocks();});
it('explains finance access and links to authorized reports without querying raw sources',async()=>{
 m.operations.mockResolvedValue({client:{from:m.from},context:{owner:false,canReview:true}});
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'})}));
 expect(html).toContain('此功能需要管理员账号');expect(html).toContain('/zh/operations/source-data');expect(m.from).not.toHaveBeenCalled();expect(m.config).not.toHaveBeenCalled();
});
it('explains an unavailable access lookup without exposing source data or configuration',async()=>{
 m.operations.mockResolvedValue({client:{from:m.from},context:null});
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'})}));expect(html).toContain('暂时无法读取访问权限');expect(m.from).not.toHaveBeenCalled();expect(m.config).not.toHaveBeenCalled();
});
