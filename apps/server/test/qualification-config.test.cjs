const {test}=require('node:test');const assert=require('node:assert/strict');
const {settings}=require('../dist/config.js');
test('supplier qualification policy defaults to legacy behavior and rejects ambiguous configuration',()=>{
 const previous=process.env.REQUIRE_SUPPLIER_QUALIFICATION,db=process.env.DATABASE_URL;process.env.DATABASE_URL='postgresql://fixture@127.0.0.1/test';
 try{
  delete process.env.REQUIRE_SUPPLIER_QUALIFICATION;assert.equal(settings().requireSupplierQualification,false);
  process.env.REQUIRE_SUPPLIER_QUALIFICATION='true';assert.equal(settings().requireSupplierQualification,true);
  process.env.REQUIRE_SUPPLIER_QUALIFICATION='false';assert.equal(settings().requireSupplierQualification,false);
  for(const value of ['','1','TRUE','yes',' false ']){process.env.REQUIRE_SUPPLIER_QUALIFICATION=value;assert.throws(()=>settings(),/REQUIRE_SUPPLIER_QUALIFICATION must be true or false/);}
 }finally{if(previous===undefined)delete process.env.REQUIRE_SUPPLIER_QUALIFICATION;else process.env.REQUIRE_SUPPLIER_QUALIFICATION=previous;if(db===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=db;}
});
