"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {summarize,investmentSignal,validateObservation,median}=require("../market-engine.js");
const asOf="2026-11-06T12:00:00.000Z";
function sale(id,days,price,overrides={}){
 return {sale_id:id,card_id:"base1-4",variant_id:"base1-4-holo-unlimited",grade_type:"RAW",condition:"Near Mint",sale_status:"COMPLETED",sold_at:new Date(Date.parse(asOf)-days*86400000).toISOString(),price,currency:"EUR",market:"EU",source:"Source A",...overrides};
}
test("median handles odd, even and empty samples",()=>{
 assert.equal(median([]),null);assert.equal(median([3,1,2]),2);assert.equal(median([1,3,2,4]),2.5);
});
test("separates currencies, markets, variants and grade types",()=>{
 const records=[
  sale("a",2,10),sale("b",3,12),
  sale("c",2,20,{currency:"USD"}),
  sale("d",2,30,{market:"US"}),
  sale("e",2,40,{variant_id:"base1-4-reverse"}),
  sale("f",2,50,{grade_type:"PSA10",condition:"PSA 10"})
 ];
 const result=summarize(records,{as_of:asOf});
 assert.equal(result.valuations.length,5);
 assert.equal(result.accepted_count,6);
});
test("deduplicates sale IDs and rejects asking prices, lots and future sales",()=>{
 const records=[
  sale("same",2,10),sale("same",1,99),
  sale("listing",2,20,{sale_status:"LISTED"}),
  sale("lot",2,30,{is_lot:true}),
  sale("future",0,40,{sold_at:"2027-01-01T00:00:00.000Z"})
 ];
 const result=summarize(records,{as_of:asOf});
 assert.equal(result.accepted_count,1);
 assert.equal(result.excluded_count,4);
 assert.ok(result.excluded.some(x=>x.reasons.some(r=>r.includes("Duplicate"))));
 assert.ok(result.excluded.some(x=>x.reasons.some(r=>r.includes("Future"))));
});
test("raw sales require a condition and PSA 10 requires PSA 10 label",()=>{
 assert.ok(validateObservation(sale("x",1,10,{condition:""})).some(x=>x.includes("condition")));
 assert.ok(validateObservation(sale("y",1,10,{grade_type:"PSA10",condition:"Near Mint"})).some(x=>x.includes("PSA 10")));
});
test("valuation reports rolling and prior-period medians",()=>{
 const records=[sale("a",5,10),sale("b",10,20),sale("c",40,30),sale("d",50,40)];
 const v=summarize(records,{as_of:asOf}).valuations[0];
 assert.equal(v.median_30d,15);
 assert.equal(v.median_90d,25);
 assert.equal(v.prior_30_90d_median,35);
 assert.equal(v.trend_30d_vs_prior_percent,-57.1);
});
test("investment signal fails closed without adequate evidence",()=>{
 const result=investmentSignal({confidence_score:40,sales_90d:3,source_count_90d:1,median_90d:100},70);
 assert.equal(result.signal,"INSUFFICIENT DATA");
});
test("buy candidate requires strong evidence and meaningful discount",()=>{
 const result=investmentSignal({confidence_score:80,sales_90d:20,source_count_90d:3,median_90d:100,trend_30d_vs_prior_percent:2},80);
 assert.equal(result.signal,"BUY CANDIDATE");
 assert.equal(result.upside_percent,25);
});
