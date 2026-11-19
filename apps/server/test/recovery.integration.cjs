const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
require('../dist/config.js');
const { migrate } = require('../dist/database/migrate.js');
const { totp } = require('../dist/auth/crypto.js');

test('identity recovery requires two administrators, expires, revokes factors and resists replay', async () => {
  const original = process.env.DATABASE_URL;
  process.env.MFA_ENCRYPTION_KEY='8'.repeat(64); process.env.ADMIN_SETUP_TOKEN='9'.repeat(64);
  const owner=new Pool({connectionString:original}); const schema='erp_test_'+randomUUID().replaceAll('-','');
  const url=new URL(original);url.searchParams.set('options',`-c search_path=${schema}`);
  await owner.query(`CREATE SCHEMA "${schema}"`);process.env.DATABASE_URL=url.toString();const pool=new Pool({connectionString:url.toString()});let app;
  try {
    await migrate(pool); app=await require('../dist/bootstrap.js').createApplication();await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1';
    async function req(path,body,token){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:response.status===204?null:await response.json()};}
    const pass='initial-secure-password', next='replacement-secure-password';
    const start=await req('/auth/setup',{email:'first@test.example',password:pass,setupToken:process.env.ADMIN_SETUP_TOKEN});
    const first=await req('/auth/mfa/verify',{challenge:start.data.challenge,code:totp(start.data.enrollment.secret)});const a=first.data.token;
    async function account(email,role){const created=await req('/access/users',{email,password:pass,role},a);assert.equal(created.status,201);const login=await req('/auth/login',{email,password:pass});const session=await req('/auth/mfa/verify',{challenge:login.data.challenge,code:totp(login.data.enrollment.secret)});return {id:created.data.id,token:session.data.token,codes:session.data.recoveryCodes};}
    const second=await account('second@test.example','admin');const reader=await account('reader@test.example','reader');
    const b=second.token, body={email:'reader@test.example',verified:true};
    assert.equal((await req('/identity-recovery/cases',body,reader.token)).status,403);
    assert.equal((await req('/identity-recovery/cases',{email:'first@test.example',verified:true},a)).status,403);
    const request=await req('/identity-recovery/cases',body,a);assert.equal(request.status,201);const id=request.data.id;
    assert.equal((await req(`/identity-recovery/cases/${id}/approve`,{verified:true},a)).status,403);
    const issued=await req(`/identity-recovery/cases/${id}/approve`,{verified:true},b);assert.equal(issued.status,201);const secret=issued.data.token;
    assert.equal((await req('/identity-recovery/redeem',{token:'f'.repeat(64),newPassword:next})).status,401);
    const pending=await req('/auth/login',{email:'reader@test.example',password:pass});
    const concurrent=await Promise.all([1,2].map(()=>req('/identity-recovery/redeem',{token:secret,newPassword:next})));
    assert.deepEqual(concurrent.map(x=>x.status).sort(),[204,401]);
    assert.equal((await req('/auth/me',undefined,reader.token)).status,401);
    assert.equal((await req('/auth/mfa/verify',{challenge:pending.data.challenge,code:reader.codes[0]})).status,401);
    assert.equal((await req('/auth/login',{email:'reader@test.example',password:pass})).status,401);
    const login=await req('/auth/login',{email:'reader@test.example',password:next});assert.equal(login.status,201);assert.ok(login.data.enrollment);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM erp_mfa_recovery_codes WHERE user_id=$1',[reader.id])).rows[0].n,0);
    const nextSession=await req('/auth/mfa/verify',{challenge:login.data.challenge,code:totp(login.data.enrollment.secret)});assert.equal(nextSession.status,201);assert.equal(nextSession.data.recoveryCodes.length,8);
    const cancelled=await req('/identity-recovery/cases',body,a);const issued2=await req(`/identity-recovery/cases/${cancelled.data.id}/approve`,{verified:true},b);
    assert.equal((await req(`/identity-recovery/cases/${cancelled.data.id}/cancel`,{},a)).status,204);
    assert.equal((await req('/identity-recovery/redeem',{token:issued2.data.token,newPassword:pass})).status,401);
    const exp=await req('/identity-recovery/cases',body,a);const expToken=await req(`/identity-recovery/cases/${exp.data.id}/approve`,{verified:true},b);
    await pool.query("UPDATE erp_identity_recoveries SET expires_at=now()-interval '1 second' WHERE id=$1",[exp.data.id]);
    assert.equal((await req('/identity-recovery/redeem',{token:expToken.data.token,newPassword:pass})).status,401);
    const changed=await req('/identity-recovery/cases',body,a);const changedToken=await req(`/identity-recovery/cases/${changed.data.id}/approve`,{verified:true},b);
    const patch=await fetch(base+'/access/users/'+reader.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${a}`},body:JSON.stringify({role:'accountant',active:true})});assert.equal(patch.status,200);
    assert.equal((await req('/identity-recovery/redeem',{token:changedToken.data.token,newPassword:pass})).status,401);
    const stale=await req('/identity-recovery/cases',body,a);const staleToken=await req(`/identity-recovery/cases/${stale.data.id}/approve`,{verified:true},b);
    const demote=await fetch(base+'/access/users/'+second.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${a}`},body:JSON.stringify({role:'reader',active:true})});assert.equal(demote.status,200);
    assert.equal((await req('/identity-recovery/redeem',{token:staleToken.data.token,newPassword:pass})).status,401);
    assert.equal((await req('/identity-recovery/cases',{email:'first@test.example',verified:true},b)).status,401);
    const disable=await fetch(base+'/access/users/'+reader.id,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${a}`},body:JSON.stringify({role:'accountant',active:false})});assert.equal(disable.status,200);
    assert.equal((await req('/identity-recovery/cases',body,a)).status,403);
    await pool.query('UPDATE erp_users SET privacy_restricted=true WHERE id=$1',[reader.id]);
    assert.equal((await req('/identity-recovery/cases',body,a)).status,403);
    let throttled=false;for(let i=0;i<25;i++){const result=await req('/identity-recovery/redeem',{token:'invalid',newPassword:pass});if(result.status===429){throttled=true;break;}assert.equal(result.status,401);}assert.equal(throttled,true);
    const serial=JSON.stringify((await pool.query('SELECT * FROM erp_audit_events')).rows);
    for(const value of [secret,issued2.data.token,expToken.data.token,pass,next,reader.token,...reader.codes]) assert.ok(!serial.includes(value));
    assert.match(serial,/identity_recovery.completed/);
  } finally { if(app)await app.close();await pool.end();process.env.DATABASE_URL=original;await owner.query(`DROP SCHEMA "${schema}" CASCADE`);await owner.end(); }
});
