// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import FundsQuery from '@/components/operations/FundsQuery';
afterEach(cleanup);
it('submits the newly selected company for current balance without a monthly-query prerequisite',()=>{const {container}=render(<FundsQuery locale="zh" organizations={[{id:'first',name:'First company'},{id:'second',name:'Second company'}]} company="first" month="2026-10" lastMonth="2026-10" monthly={false}/>);fireEvent.change(screen.getByLabelText('客户企业'),{target:{value:'second'}});const button=screen.getByRole('button',{name:'查看当前余额与流水'}) as HTMLButtonElement;const form=container.querySelector('form')!;expect(new FormData(form,button).get('company')).toBe('second');expect(new FormData(form,button).get('view')).toBe('current');expect(button.formNoValidate).toBe(true);expect(container.querySelector('a')).toBeNull();expect(container.querySelector('details')!.open).toBe(false);});
