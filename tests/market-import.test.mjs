"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {parseCSV,normalizeRows,importCSV} from "../tools/import-market-observations.mjs";

const header="sale_id,card_id,variant_id,grade_type,condition,sale_status,sold_at,price,currency,market,source,source_url,is_lot,notes";
const row=(id,overrides={})=>({sale_id:id,card_id:"base1-4",variant_id:"base1-4-holo-unlimited",grade_type:"RAW",condition:"Near Mint",sale_status:"COMPLETED",sold_at:"2026-11-05T12:00:00Z",price:"42.50",currency:"EUR",market:"EU",source:"eBay",source_url:"https://example.com/sale/1",is_lot:"false",notes:"",...overrides});
const csv=(records)=>[header,...records.map(r=>[r.sale_id,r.card_id,r.variant_id,r.grade_type,r.condition,r.sale_status,r.sold_at,r.price,r.currency,r.market,r.source,r.source_url,r.is_lot,r.notes].map(v=>{const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(","))].join("\n");

test("CSV parser handles quoted commas, escaped quotes and line breaks",()=>{
 const rows=parseCSV('a,b\n"one, two","say ""hi"""\n"line one\nline two",x');
 assert.deepEqual(rows,[["a","b"],["one, two",'say "hi"'],["line one\nline two","x"]]);
});
test("normalizes valid completed English sales and defaults language",()=>{
 const result=normalizeRows(csv([row("s1")]),{asOf:"2026-11-06T12:00:00Z"});
 assert.equal(result.accepted.length,1);assert.equal(result.accepted[0].price,42.5);
 assert.equal(result.accepted[0].language,"English");assert.equal(result.excluded.length,0);
});
test("rejects listings, lots, duplicate IDs, future sales and invalid currencies",()=>{
 const result=normalizeRows(csv([
  row("a"),row("b",{sale_status:"LISTED"}),row("c",{is_lot:"true"}),
  row("a"),row("d",{sold_at:"2027-01-01T00:00:00Z"}),row("e",{currency:"eur"})
 ]),{asOf:"2026-11-06T12:00:00Z"});
 assert.equal(result.accepted.length,1);assert.equal(result.excluded.length,5);
});
test("requires explicit condition and PSA 10 label",()=>{
 const result=normalizeRows(csv([row("a",{condition:""}),row("b",{grade_type:"PSA10",condition:"Near Mint"})]));
 assert.equal(result.accepted.length,0);assert.equal(result.excluded.length,2);
});
test("writes immutable JSONL batch and provenance manifest",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"raresignal-import-"));
 try{
  const input=path.join(dir,"sales.csv"),output=path.join(dir,"batch.jsonl");
  fs.writeFileSync(input,csv([row("sale-1")]));
  const result=importCSV({inputPath:input,outputPath:output,asOf:"2026-11-06T12:00:00Z"});
  assert.equal(result.accepted.length,1);assert.equal(fs.readFileSync(output,"utf8").trim().split("\n").length,1);
  assert.ok(fs.existsSync(output+".manifest.json"));
  assert.throws(()=>importCSV({inputPath:input,outputPath:output}),/Refusing to overwrite/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
