import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),failures=[],passed=[];
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function check(name,condition){(condition?passed:failures).push(name);}
try {
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 check('Secret files are untracked',!tracked.some(p=>/(^|\/)(\.env(\..+)?|secrets\/.*|.*\.(key|p12|pfx))$/i.test(p)&&!p.endsWith('.env.example')));
 const main=read('apps/desktop/src/main/main.ts'),preload=read('apps/desktop/src/main/preload.ts'),bootstrap=read('apps/server/src/bootstrap.ts');
 for(const [name,pattern] of [['Electron sandbox',/sandbox:\s*true/],['Context isolation',/contextIsolation:\s*true/],['Node integration disabled',/nodeIntegration:\s*false/],['IPC sender checks',/validateSender\(event\)/],['Navigation controlled',/will-navigate/],['Permissions denied by default',/setPermissionRequestHandler/]]) check(name,pattern.test(main));
 check('No raw renderer IPC bridge',!/(?:send|invoke)\s*:\s*\(?\s*(?:channel|name)/.test(preload));
 check('Renderer network disabled by CSP',read('apps/desktop/src/renderer/index.html').includes("connect-src 'none'"));
 check('HTTP security headers installed',bootstrap.includes('app.use(helmet())'));
 check('Remote server requires TLS proxy confirmation',read('apps/server/src/config.ts').includes("TLS_PROXY_CONFIRMED !== 'true'"));
 check('Permission guard denies unannotated handlers',read('apps/server/src/auth/permissions.guard.ts').includes("throw new ForbiddenException"));
 check('Dependency lockfile present',JSON.parse(read('package-lock.json')).lockfileVersion>=3);
 require('../apps/server/dist/config.js');
 const key=process.env.MFA_ENCRYPTION_KEY,setup=process.env.ADMIN_SETUP_TOKEN;
 check('MFA encryption key configured',/^[a-f0-9]{64}$/i.test(key||'') && new Set(key).size>8);
 check('Initial setup token configured',/^[a-f0-9]{64}$/i.test(setup||'') && new Set(setup).size>8);
 check('Independent setup and encryption secrets',!!key&&!!setup&&key!==setup);
 if(process.argv.includes('--production')) {
  const {Pool}=require('pg'),pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
  try {const role=(await pool.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];check('Runtime database role has no cluster administration privileges',role&&!role.rolsuper&&!role.rolcreatedb&&!role.rolcreaterole);}
  finally{await pool.end();}
  check('TLS proxy explicitly configured',process.env.TLS_PROXY_CONFIRMED==='true');
 }
}catch {failures.push('Checks could not finish; build the server and configure local environment first');}
console.log(JSON.stringify({passed,failures,scope:'Repository and configuration checks only. Run security:dependencies and API permission tests separately; this is not a penetration test.'},null,2));
if(failures.length)process.exitCode=1;
