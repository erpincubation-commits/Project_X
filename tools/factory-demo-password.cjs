// Changes only the named synthetic accounts in the isolated factory demo.
const {resolve}=require('node:path');const {Pool}=require('pg');const {hash}=require('bcryptjs');
const password=process.env.FACTORY_DEMO_PASSWORD;
if(!password||password.length<12||Buffer.byteLength(password,'utf8')>72)throw new Error('Set FACTORY_DEMO_PASSWORD privately to 12–72 UTF-8 bytes.');
const pool=new Pool({connectionString:'postgresql://p2p_test@127.0.0.1:55439/erp_factory_demo'});
(async()=>{try{
 const directory=(await pool.query('SHOW data_directory')).rows[0].data_directory;
 if(resolve(directory).toLowerCase()!==resolve('.local/p2p-test-cluster-user').toLowerCase())throw new Error('Not the expected isolated PostgreSQL cluster.');
 const names=['admin','buyer','warehouse','finance','approver','approver2'].map(n=>`${n}@factory-demo.test`);
 const count=Number((await pool.query('SELECT count(*) FROM erp_users WHERE email=ANY($1::text[])',[names])).rows[0].count);
 if(count!==names.length)throw new Error('The complete demo accounts were not found.');
 const client=await pool.connect();try{await client.query('BEGIN');await client.query('UPDATE erp_users SET password_hash=$1,auth_version=auth_version+1 WHERE email=ANY($2::text[])',[await hash(password,12),names]);await client.query('DELETE FROM erp_sessions WHERE user_id IN (SELECT id FROM erp_users WHERE email=ANY($1::text[]))',[names]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 console.log('Demo account passwords updated. No password was printed.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{await pool.end();}})();
