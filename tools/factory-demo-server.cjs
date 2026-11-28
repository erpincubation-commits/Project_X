// Local-only demo API. It never uses the business DATABASE_URL and never reuses another API.
const {readFileSync}=require('node:fs');const {resolve}=require('node:path');const {Pool}=require('pg');
const demoUrl='postgresql://p2p_test@127.0.0.1:55439/erp_factory_demo';
const pool=new Pool({connectionString:demoUrl,connectionTimeoutMillis:3000});
(async()=>{try{
 const directory=(await pool.query('SHOW data_directory')).rows[0].data_directory;
 if(resolve(directory).toLowerCase()!==resolve('.local/p2p-test-cluster-user').toLowerCase())throw new Error('Not the expected isolated PostgreSQL cluster.');
 if(Number((await pool.query("SELECT count(*) FROM erp_users WHERE email LIKE '%@factory-demo.test'")).rows[0].count)!==6)throw new Error('The complete demo accounts were not found.');
 const key=readFileSync(resolve('.local/factory-demo-private/mfa.key'),'utf8').trim();if(!/^[a-f0-9]{64}$/.test(key))throw new Error('The protected demo MFA key is missing or invalid.');
 process.env.DATABASE_URL=demoUrl;process.env.SERVER_HOST='127.0.0.1';process.env.SERVER_PORT='3314';process.env.MFA_ENCRYPTION_KEY=key;
 const {createApplication}=require('../apps/server/dist/bootstrap.js');const app=await createApplication();
 await app.listen(3314,'127.0.0.1');console.log('Factory demo API ready at http://127.0.0.1:3314/api/v1');
}catch(error){console.error(`Factory demo could not start: ${error.code||error.message}`);process.exitCode=1;}finally{await pool.end();}})();
