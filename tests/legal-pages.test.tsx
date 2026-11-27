import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('@/components/SiteHeader',()=>({default:()=>null}));
vi.mock('@/components/BrandLogo',()=>({default:()=> <span>智点未来</span>}));
import LegalDocument from '@/components/LegalDocument';
import {legalContent} from '@/lib/legal-content';
it.each(['zh','en'] as const)('provides linked privacy and terms documents with the correct brand and contact (%s)',locale=>{
 for(const document of ['privacy','terms'] as const){
 const html=renderToStaticMarkup(<LegalDocument locale={locale} document={document}/>);
 expect(html).toContain(`<h1>${legalContent[locale][document].title}</h1>`);
 expect(html).toContain('智点未来');expect(html).not.toContain('字典未来');expect(html).not.toMatch(/Regus|IWG|DEVELOPMENT DRAFT|开发草案|尚未接入数据库/);
 expect(html).toContain('mailto:info@kbjmcorp.com');expect(html).toContain(`href="/${locale}/privacy"`);expect(html).toContain(`href="/${locale}/terms"`);expect(legalContent[locale][document].sections).toHaveLength(document==='privacy'?12:17);
 }
});
