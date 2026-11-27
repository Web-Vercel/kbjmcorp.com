// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import Link,{DraftProgressTarget} from '@/components/operations/DraftProgressLink';
const scroll=vi.fn();
beforeEach(()=>{scroll.mockClear();Element.prototype.scrollIntoView=scroll;vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 1;});window.history.replaceState(null,'','/zh/operations/settlements?company=fixture&draft=one');});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('opens collapsed ancestors, scrolls and focuses the draft on first navigation',()=>{
 render(<><details data-testid="history"><summary>History</summary><article id="draft-one">Draft one</article></details><DraftProgressTarget id="one"/></>);
 expect((screen.getByTestId('history') as HTMLDetailsElement).open).toBe(true);expect(scroll).toHaveBeenCalled();expect(document.activeElement?.id).toBe('draft-one');
});
it('repeated clicks on the same URL still reopen and locate the draft',()=>{
 render(<><Link id="one" href="/zh/operations/settlements?company=fixture&draft=one#draft-one">查看现有草稿与进度</Link><details data-testid="history"><summary>History</summary><article id="draft-one">Draft one</article></details></>);
 const details=screen.getByTestId('history') as HTMLDetailsElement;
 fireEvent.click(screen.getByRole('link'));expect(details.open).toBe(true);details.open=false;
 fireEvent.click(screen.getByRole('link'));expect(details.open).toBe(true);expect(scroll).toHaveBeenCalledTimes(2);
});
