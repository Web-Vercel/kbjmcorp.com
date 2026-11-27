import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Workflow from '@/components/operations/AdsSyncWorkflow';
const base={locale:'zh' as const,active:true,unavailable:false,workerReady:true,company:'company-a'};
it('collapses manual actions for an enabled account and links the actual job month and draft',()=>{
 const html=renderToStaticMarkup(<Workflow {...base} enabled job={{month:'2026-10-01',state:'prepared',source_id:'source-a',draft_id:'draft-a'}}><button>手动读取</button></Workflow>);
 expect(html).toContain('自动月结已启用');expect(html).toContain('<details');expect(html).not.toContain('<details open');expect(html).toContain('手动查询与异常处理');expect(html).toContain('草稿已生成');expect(html).toContain('company=company-a&amp;month=2026-10#draft-draft-a');
});
it('shows manual processing for a disabled account without implying automatic execution',()=>{
 const html=renderToStaticMarkup(<Workflow {...base} enabled={false}><button>手动读取</button></Workflow>);
 expect(html).toContain('自动月结未启用');expect(html).toContain('手动处理');expect(html).not.toContain('<details');
});
it('keeps uncertainty, paused access and unconfigured worker visible',()=>{
 const html=renderToStaticMarkup(<Workflow {...base} enabled={false} unavailable><button>手动读取</button></Workflow>);
 expect(html).toContain('自动月结状态暂不可用');expect(html).not.toContain('自动月结未启用');expect(html).toContain('<details');
 const blocked=renderToStaticMarkup(<Workflow {...base} enabled active={false} workerReady={false}><button>手动读取</button></Workflow>);
 expect(blocked).toContain('账户交接访问已暂停');expect(blocked).toContain('自动任务运行配置未就绪');
});
