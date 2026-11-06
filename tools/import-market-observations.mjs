#!/usr/bin/env node
/**
 * RareSignal local completed-sale CSV importer.
 * No network access. Accepted rows are written to a new JSONL batch plus provenance manifest.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import engine from "../market-engine.js";

const REQUIRED=["sale_id","card_id","variant_id","grade_type","sale_status","sold_at","price","currency","market","source"];
const OPTIONAL=["condition","source_url","is_lot","notes"];
const ALLOWED=new Set([...REQUIRED,...OPTIONAL,"language"]);

export function parseCSV(text){
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(c==='"')quoted=false;
      else field+=c;
    }else if(c==='"'&&field==="")quoted=true;
    else if(c===","){row.push(field);field="";}
    else if(c==="\n"){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}
    else field+=c;
  }
  if(quoted)throw new Error("CSV contains an unterminated quoted field.");
  if(field!==""||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
  return rows.filter(r=>!(r.length===1&&r[0]===""));
}
function clean(v){return String(v??"").trim();}
function normalizeRow(row,headers,index){
  const raw=Object.fromEntries(headers.map((h,i)=>[h,clean(row[i])]));
  const extra=Object.keys(raw).filter(k=>!ALLOWED.has(k));
  const missing=REQUIRED.filter(k=>!headers.includes(k));
  const errors=[];
  if(missing.length)errors.push("CSV missing required columns: "+missing.join(", "));
  if(extra.length)errors.push("Unsupported columns: "+extra.join(", "));
  const o={};
  for(const key of REQUIRED)if(raw[key]!==undefined)o[key]=raw[key];
  o.language=raw.language||"English";
  if(raw.price!==undefined&&raw.price!=="")o.price=Number(raw.price);
  if(raw.is_lot!==undefined&&raw.is_lot!==""){
    const v=raw.is_lot.toLowerCase();
    if(["true","1","yes"].includes(v))o.is_lot=true;
    else if(["false","0","no"].includes(v))o.is_lot=false;
    else errors.push("is_lot must be true/false, yes/no or 1/0.");
  }else o.is_lot=false;
  for(const key of ["condition","source_url","notes"])if(raw[key])o[key]=raw[key];
  if(o.language!=="English")errors.push("This importer currently accepts English observations only.");
  if(o.source_url&&!/^https?:\/\//i.test(o.source_url))errors.push("source_url must be an HTTP(S) URL.");
  return {row_number:index+2,observation:o,errors};
}
export function normalizeRows(csvText,{asOf=new Date().toISOString()}={}){
  const rows=parseCSV(csvText);
  if(rows.length<2)return {accepted:[],excluded:[{row_number:1,reasons:["CSV must contain a header and at least one data row."]}]};
  const headers=rows[0].map(h=>clean(h).replace(/^\uFEFF/,""));
  const seen=new Set(),accepted=[],excluded=[];
  rows.slice(1).forEach((row,i)=>{
    const result=normalizeRow(row,headers,i+1),o=result.observation;
    if(row.length!==headers.length)result.errors.push("Column count does not match the CSV header.");
    result.errors.push(...engine.validateObservation(o));
    const date=Date.parse(o.sold_at);
    if(Number.isFinite(date)&&date>Date.parse(asOf))result.errors.push("Future-dated sales are not eligible.");
    if(o.sale_id&&seen.has(o.sale_id))result.errors.push("Duplicate sale_id within this CSV batch.");
    if(o.sale_id)seen.add(o.sale_id);
    if(result.errors.length)excluded.push({row_number:result.row_number,sale_id:o.sale_id||null,reasons:[...new Set(result.errors)]});
    else accepted.push(o);
  });
  return {accepted,excluded};
}
export function importCSV({inputPath,outputPath,asOf=new Date().toISOString()}){
  if(!inputPath||!outputPath)throw new Error("Usage: node tools/import-market-observations.mjs --input <file.csv> --out <new-batch.jsonl> [--as-of <ISO-date>]");
  const input=path.resolve(inputPath),output=path.resolve(outputPath),manifest=output+".manifest.json";
  if(!fs.existsSync(input))throw new Error("Input file not found: "+input);
  if(fs.existsSync(output)||fs.existsSync(manifest))throw new Error("Refusing to overwrite an existing batch or manifest. Choose a new output filename.");
  const source=fs.readFileSync(input);
  const parsed=normalizeRows(source.toString("utf8"),{asOf});
  if(!parsed.accepted.length)throw new Error("No valid observations to write. Excluded rows: "+parsed.excluded.length);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const jsonl=parsed.accepted.map(o=>JSON.stringify(o)).join("\n")+"\n";
  fs.writeFileSync(output,jsonl,{flag:"wx"});
  const manifestData={
    batch_version:1,created_at:new Date().toISOString(),as_of:asOf,
    input_file:path.basename(input),input_sha256:crypto.createHash("sha256").update(source).digest("hex"),
    output_file:path.basename(output),accepted_count:parsed.accepted.length,excluded_count:parsed.excluded.length,
    excluded:parsed.excluded,
    policy:"Append-only batch. Completed English sales only; no listings, lots, duplicate sale IDs, future dates, FX conversion or inferred identity."
  };
  fs.writeFileSync(manifest,JSON.stringify(manifestData,null,2)+"\n",{flag:"wx"});
  return {output,manifest,...parsed};
}
function cli(){
  const args=process.argv.slice(2),opts={};
  for(let i=0;i<args.length;i++){if(args[i].startsWith("--"))opts[args[i].slice(2)]=args[++i];}
  try{
    const result=importCSV({inputPath:opts.input,outputPath:opts.out,asOf:opts["as-of"]||new Date().toISOString()});
    console.log("Accepted: "+result.accepted.length+" | Excluded: "+result.excluded.length);
    console.log("JSONL: "+result.output+"\nManifest: "+result.manifest);
    if(result.excluded.length)console.log(JSON.stringify(result.excluded,null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cli();
