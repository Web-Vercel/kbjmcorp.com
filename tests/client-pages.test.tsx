// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),guard:vi.fn(),membership:vi.fn(),project:vi.fn(),projectIn:vi.fn()}));
vi.mock("@/lib/auth/server",()=>({authClient:mocks.auth}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`redirect:${url}`)},notFound:()=>{throw new Error('not-found')}}));
vi.mock("@/components/SiteHeader",()=>({default:()=>null}));
vi.mock("@/components/SiteFooter",()=>({default:()=>null}));
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import { requireClientPage } from "@/lib/client/page";
import Project from "@/app/[locale]/account/projects/[id]/page";
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({auth:{getUser:()=>Promise.resolve({data:{user:{id:'verified-user'}},error:null})},from:(table:string)=>table==='memberships'?{select:()=>({eq:mocks.membership})}:{select:()=>({eq:()=>({in:mocks.projectIn})})}});mocks.membership.mockResolvedValue({data:[{organization_id:'org-a'}],error:null});mocks.projectIn.mockReturnValue({maybeSingle:mocks.project});mocks.project.mockResolvedValue({data:null,error:null});});
afterEach(cleanup);
it("redirects unauthenticated or unavailable sessions to client login",async()=>{mocks.auth.mockResolvedValue(null);await expect(requireClientPage('zh')).rejects.toThrow('redirect:/zh/login');mocks.auth.mockResolvedValue({auth:{getUser:()=>Promise.reject(new Error('provider unavailable'))}});await expect(requireClientPage('en')).rejects.toThrow('redirect:/en/login');});
it("returns 404 for guessed project identifiers and filters by verified membership",async()=>{await expect(Project({params:Promise.resolve({locale:'zh',id})})).rejects.toThrow('not-found');expect(mocks.projectIn).toHaveBeenCalledWith('organization_id',['org-a']);expect(mocks.membership).toHaveBeenCalledWith('user_id','verified-user');});
it("does not query projects for a user without a company association",async()=>{mocks.membership.mockResolvedValue({data:[],error:null});await expect(Project({params:Promise.resolve({locale:'zh',id})})).rejects.toThrow('not-found');expect(mocks.projectIn).not.toHaveBeenCalled();});
it("renders a retry state on database failure rather than false not-found",async()=>{mocks.membership.mockResolvedValue({data:null,error:{code:'unavailable'}});render(await Project({params:Promise.resolve({locale:'zh',id})}));expect(screen.getByText('暂时无法读取项目，请稍后重试。')).toBeTruthy();expect(mocks.projectIn).not.toHaveBeenCalled();});

it('preserves only a validated client statement destination across login',async()=>{
 const target=`/zh/account/statements?statement=${id}#statement-${id}`;mocks.auth.mockResolvedValue(null);
 await expect(requireClientPage('zh',target)).rejects.toThrow(`redirect:/zh/login?${new URLSearchParams({returnTo:target})}`);
 await expect(requireClientPage('zh','https://evil.example')).rejects.toThrow('redirect:/zh/login');
});
