import {it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({context:vi.fn(),redirect:vi.fn((path:string)=>{throw Error('redirect:'+path)})}));
vi.mock('@/lib/live-access/server',()=>({getLiveContext:m.context}));
vi.mock('next/navigation',()=>({redirect:m.redirect,notFound:()=>{throw Error('not found')}}));
vi.mock('@/components/partners/RefundWorkspace',()=>({default:()=>null}));
import Page from '@/app/[locale]/account/refunds/page';
beforeEach(()=>vi.clearAllMocks());
it('opens refunds for a validated password-only client without another MFA check',async()=>{const client={};m.context.mockResolvedValue({client,context:{role:'client'}});const page=await Page({params:Promise.resolve({locale:'zh'})});expect(page.props.client).toBe(client);expect(m.redirect).not.toHaveBeenCalled();});
it('keeps other roles and expired sessions outside the client refund page',async()=>{for(const role of ['agent','investor','sales']){m.context.mockResolvedValue({context:{role}});await expect(Page({params:Promise.resolve({locale:'zh'})})).rejects.toThrow('redirect:/zh/access');}m.context.mockResolvedValue({error:'unauthenticated'});await expect(Page({params:Promise.resolve({locale:'zh'})})).rejects.toThrow('redirect:/zh/access/login');});
