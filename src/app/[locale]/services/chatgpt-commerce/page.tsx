import ServiceExamples from '@/components/ServiceExamples';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import {chatgptServiceCopy} from '@/lib/chatgpt-services';
import styles from '@/components/ChatGPTServices.module.css';
export function generateStaticParams(){return [{locale:'zh'},{locale:'en'}];}
export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const t=chatgptServiceCopy(locale);return {title:locale==='zh'?'ChatGPT 电商接入服务 | 智点未来':'ChatGPT Commerce integration | 智点未来',description:t.commerceIntro,alternates:{languages:{'zh-CN':'/zh/services/chatgpt-commerce',en:'/en/services/chatgpt-commerce'}}};}
export default async function Commerce({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh',t=chatgptServiceCopy(locale);
 return <><SiteHeader locale={locale} path="/services/chatgpt-commerce"/><main id="main" className={'wrap '+styles.detail}><Link className="service-link" href={'/'+locale+'#chatgpt-services'}>← {t.back}</Link><p className={'eyebrow '+styles.eyebrow}>CHATGPT COMMERCE</p><h1>{t.commerceTitle}</h1><p className={styles.lead}>{t.commerceIntro}</p><p className={styles.notice}>{t.commerceNotice}</p><Link className="button" href={'/'+locale+'#contact'}>{t.contact} ↗</Link>
 <ServiceExamples locale={locale} kind="commerce"/>
 <section><h2>{t.stepsTitle}</h2><div className={styles.steps}>{t.steps.map(([title,body],i)=><article className={styles.step} key={title}><span>0{i+1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
 <section><h2>{t.conceptsTitle}</h2>{t.concepts.map(([title,body])=><article className={styles.concept} key={title}><h3>{title}</h3><p>{body}</p></article>)}<p className={styles.scope}>{t.scope}</p></section>
 <section><h2>{t.prepareTitle}</h2><ul className={styles.prepare}>{t.prepare.map(item=><li key={item}>{item}</li>)}</ul></section>
 <div className={styles.related}><Link className="button" href={'/'+locale+'#contact'}>{t.contact} ↗</Link><p><Link className="service-link" href={'/'+locale+'/platforms/chatgpt-ads'}>{zh?'了解 ChatGPT 广告代理服务':'Explore ChatGPT advertising services'} ↗</Link></p></div></main><SiteFooter locale={locale}/></>;
}
