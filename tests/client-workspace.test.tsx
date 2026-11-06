// @vitest-environment jsdom
import React from "react";
import { cleanup,render,screen } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import ClientWorkspace from "@/components/client/ClientWorkspace";
afterEach(cleanup);
const organization={id:"org-a",name:"Fictional company A"};
const project={id:"project-a",organization_id:"org-a",name:"Fictional campaign",status:"creative",target_market:"global",created_at:"2026-11-01T18:00:00Z",updated_at:"2026-11-05T18:00:00Z"};
it("shows client project progress with a detail link, without suggesting live metrics",()=>{
 render(<ClientWorkspace locale="zh" organizations={[organization]} projects={[project]}/>);
 expect(screen.getByText('Fictional campaign')).toBeTruthy();expect(screen.getAllByText('素材准备').length).toBeGreaterThan(0);
 expect(screen.getByRole('link',{name:/查看项目详情/}).getAttribute('href')).toBe('/zh/account/projects/project-a');
 expect(screen.getByText(/并非广告平台实时投放状态/)).toBeTruthy();
});
it("does not present business mutations or detail links in the fictional preview",()=>{
 const {container}=render(<ClientWorkspace locale="en" organizations={[organization]} projects={[project]} demo/>);
 expect(container.querySelector('form')).toBeNull();expect(container.querySelector('a')).toBeNull();
});
it("shows a waiting state for an authenticated unassociated user",()=>{render(<ClientWorkspace locale="zh" organizations={[]} projects={[]}/>);expect(screen.getByText('等待关联客户公司')).toBeTruthy();});
it("fails closed without showing partial projects or false zero counts",()=>{render(<ClientWorkspace locale="en" organizations={[organization]} projects={[project]} error/>);expect(screen.getByText('Client information is unavailable')).toBeTruthy();expect(screen.queryByText('Fictional campaign')).toBeNull();});
it("does not render a project that belongs to a company absent from the workspace",()=>{render(<ClientWorkspace locale="en" organizations={[organization]} projects={[{...project,organization_id:'other-org'}]}/>);expect(screen.queryByText('Fictional campaign')).toBeNull();});
