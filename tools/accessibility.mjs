import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),axeSource=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
export async function verifyAccessibility(page,name,root) {
 await page.evaluate(axeSource);
 const report=await page.evaluate(async()=>{
  const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
  return {url:location.protocol,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,helpUrl:v.helpUrl,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,count:v.nodes.length})),passes:r.passes.length};
 });
 // Verify visible keyboard focus is reachable; no screenshots or personal page text in reports.
 await page.evaluate(()=>{const h=document.querySelector('h1');h.setAttribute('tabindex','-1');h.focus();});await page.keyboard.press('Tab');
 const keyboard=await page.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return false;const s=getComputedStyle(e);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;});
 report.keyboardFocusVisible=keyboard;
 await page.locator('.skip-link').focus();await page.keyboard.press('Enter');
 report.skipLinkWorks=await page.evaluate(()=>document.activeElement?.id==='main-content'&&location.hash==='');
 mkdirSync(new URL('../.local/accessibility/',import.meta.url),{recursive:true});
 writeFileSync(new URL(`../.local/accessibility/${name}.json`,import.meta.url),JSON.stringify(report,null,2));
 if(report.violations.length||!keyboard||!report.skipLinkWorks) throw new Error(`Accessibility check failed for ${name}. Inspect .local/accessibility/${name}.json.`);
 return report;
}
