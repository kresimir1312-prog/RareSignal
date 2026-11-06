#!/usr/bin/env node
/**
 * RareSignal SoldComps collector.
 * Fetches eBay completed sales into a REVIEW-ONLY queue.
 * Never converts search matches into accepted observations automatically.
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://www.soldcomps.io/v1";
const KEY = process.env.SOLDCOMPS_API_KEY;
const ROOT = process.cwd();
const FEED_PATH = path.join(ROOT, "data/market-feed/pending-review.json");
const APPROVED_PATH = path.join(ROOT, "data/market-feed/auto-approved.json");
const LEDGER_PATH = path.join(ROOT, "data/market-feed/usage-ledger.json");
const MONTHLY_AUTOMATION_CAP = 560;
const MAX_MONTHLY_RUNS = 2;
const MAX_RUN_CREDITS = 280;
const LIMIT = 50;
const PROFILES = [
  {id:"umbreon-vmax-215-203-psa10",card_id:"evolving-skies-215-english",variant_id:"evolving-skies-215-203-alt-art-secret-holo-english",target_grade:"PSA10",query:'Umbreon VMAX 215/203 Evolving Skies "PSA 10" -lot -proxy'},
  {id:"umbreon-vmax-215-203-raw-nm",card_id:"evolving-skies-215-english",variant_id:"evolving-skies-215-203-alt-art-secret-holo-english",target_grade:"RAW",query:'Umbreon VMAX 215/203 Evolving Skies "Near Mint" -lot -proxy'},
  {id:"giratina-v-186-196-psa10",card_id:"lost-origin-186-english",variant_id:"lost-origin-186-196-alt-art-holo-english",target_grade:"PSA10",query:'Giratina V 186/196 Lost Origin "PSA 10" -lot -proxy'},
  {id:"giratina-v-186-196-raw-nm",card_id:"lost-origin-186-english",variant_id:"lost-origin-186-196-alt-art-holo-english",target_grade:"RAW",query:'Giratina V 186/196 Lost Origin "Near Mint" -lot -proxy'}
];
function assessListing(item, profile, now = new Date()) {
 const title=String(item.title||'').toLowerCase();
 const flags=[]; const target=profile.target_grade;
 const expectedNumber=profile.card_id.includes('evolving')?'215/203':'186/196';
 if(/\b(german|deutsch|french|français|italian|italiano|spanish|español|japanese|korean|chinese)\b/i.test(title)) flags.push('POSSIBLE_NON_ENGLISH');
 if(!/\b(english|eng)\b/i.test(title)) flags.push('LANGUAGE_NOT_CONFIRMED');
 if(!title.includes(expectedNumber)) flags.push('CARD_NUMBER_NOT_CONFIRMED');
 if(target==='PSA10' && !/\bpsa\s*10\b/i.test(title)) flags.push('TARGET_GRADE_NOT_CONFIRMED');
 if(target==='PSA10' && /\bpsa\s*(?!10\b)\d{1,2}\b/i.test(title)) flags.push('CONFLICTING_PSA_GRADE');
 if(target==='RAW' && /\b(psa|bgs|beckett|cgc|sgc)\s*\d{1,2}\b/i.test(title)) flags.push('GRADED_CARD_IN_RAW_SEARCH');
 if(target==='RAW' && !/\b(near mint|nm)\b/i.test(title)) flags.push('RAW_CONDITION_NOT_CONFIRMED');
 if(target==='RAW' && String(item.condition||'').toLowerCase()!=='new') flags.push('MARKETPLACE_CONDITION_NOT_NEW');
 if(item.best_offer_accepted===true && item.best_offer_price_known!==true) flags.push('BEST_OFFER_PRICE_UNKNOWN');
 if(item.buying_format && !['auction','fixed_price'].includes(item.buying_format)) flags.push('UNSUPPORTED_SALE_FORMAT');
 if(!item.sold_price || !Number.isFinite(Number(item.sold_price.value)) || Number(item.sold_price.value)<=0) flags.push('INVALID_OR_MISSING_PRICE');
 if(!item.sold_at || Number.isNaN(Date.parse(item.sold_at)) || new Date(item.sold_at)>now) flags.push('INVALID_OR_FUTURE_SALE_DATE');
 if(item.flags && item.flags.includes('outlier')) flags.push('PROVIDER_OUTLIER_FLAG');
 if(!item.url || !/^https:\/\/www\.ebay\.com\/itm\/\d+/.test(item.url)) flags.push('LISTING_URL_UNVERIFIED');
 const hard=['POSSIBLE_NON_ENGLISH','CONFLICTING_PSA_GRADE','GRADED_CARD_IN_RAW_SEARCH','BEST_OFFER_PRICE_UNKNOWN','INVALID_OR_MISSING_PRICE','INVALID_OR_FUTURE_SALE_DATE','UNSUPPORTED_SALE_FORMAT'];
 return {review_flags:flags,quality_tier:flags.some(x=>hard.includes(x))?'HIGH_RISK':flags.length?'NEEDS_REVIEW':'PRELIMINARY_MATCH',valuation_eligible:false,review_status:'PENDING'};
}
function autoApprove(item, profile, now = new Date()) {
 const title=String(item.title||"").toLowerCase();
 const number=profile.card_id.includes("evolving")?"215/203":"186/196";
 const cardName=profile.card_id.includes("evolving")?"umbreon vmax":"giratina";
 const setName=profile.card_id.includes("evolving")?"evolving skies":"lost origin";
 const altArt=/\b(alt\s*art|alternate\s*art|alternate\s*full\s*art|alt\s*full\s*art)\b/i.test(title);
 const flags=[];
 if(profile.target_grade!=="PSA10") flags.push("RAW_REQUIRES_MANUAL_CONDITION_REVIEW");
 if(!title.includes(cardName)) flags.push("CARD_NAME_NOT_CONFIRMED");
 if(!title.includes(setName)) flags.push("SET_NAME_NOT_CONFIRMED");
 if(!title.includes(number)) flags.push("CARD_NUMBER_NOT_CONFIRMED");
 if(!altArt) flags.push("ALT_ART_VARIANT_NOT_CONFIRMED");
 if(!/\b(english|eng)\b/i.test(title)) flags.push("ENGLISH_NOT_CONFIRMED");
 if(/\b(german|deutsch|french|français|italian|italiano|spanish|español|japanese|korean|chinese|portuguese)\b/i.test(title)) flags.push("POSSIBLE_NON_ENGLISH");
 if(!/\bpsa\s*10\b/i.test(title)) flags.push("PSA10_NOT_CONFIRMED");
 if(/\bpsa\s*(?!10\b)\d{1,2}\b/i.test(title)) flags.push("CONFLICTING_PSA_GRADE");
 if(/\b(lot|bundle|collection|proxy|replica|custom|reprint)\b/i.test(title)) flags.push("POSSIBLE_LOT_OR_NON_AUTHENTIC");
 if(item.best_offer_accepted===true&&item.best_offer_price_known!==true) flags.push("BEST_OFFER_PRICE_UNKNOWN");
 if(!["auction","fixed_price"].includes(item.buying_format)) flags.push("UNSUPPORTED_SALE_FORMAT");
 const price=Number(item.sold_price?.value),date=Date.parse(item.sold_at);
 if(!Number.isFinite(price)||price<=0) flags.push("INVALID_PRICE");
 if(!item.sold_at||!Number.isFinite(date)||date>now.getTime()) flags.push("INVALID_SALE_DATE");
 if(!["USD","EUR","GBP","CAD","AUD"].includes(String(item.sold_price?.currency||"").toUpperCase())) flags.push("UNSUPPORTED_CURRENCY");
 if(typeof item.url!=="string"||!/^https:\/\/www\.ebay\.com\/itm\/\d+$/.test(item.url)) flags.push("LISTING_URL_UNVERIFIED");
 if(Array.isArray(item.flags)&&item.flags.some(x=>/outlier/i.test(x))) flags.push("PROVIDER_OUTLIER_FLAG");
 return {eligible:flags.length===0,flags};
}
function toObservation(item,profile){return {sale_id:"soldcomps-ebay-"+item.item_id,card_id:profile.card_id,variant_id:profile.variant_id,language:"English",grade_type:"PSA10",condition:"PSA 10",sale_status:"COMPLETED",sold_at:item.sold_at,price:Number(item.sold_price.value),currency:String(item.sold_price.currency||"USD").toUpperCase(),market:"US",source:"eBay via SoldComps",marketplace:"eBay",evidence_type:"DIRECT_TRANSACTION",source_url:item.url,is_lot:false,notes:"Strict automatic acceptance; source listing retained for audit."};}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch(e){if(e.code==="ENOENT")return fallback;throw e;}}
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");}
async function apiGet(url){const r=await fetch(url,{headers:{Authorization:`Bearer ${KEY}`,Accept:"application/json"},signal:AbortSignal.timeout(45000)});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`SoldComps ${r.status}: ${body?.error?.code||JSON.stringify(body).slice(0,300)}`);return body;}
async function main(){
 if(!KEY)throw new Error("Missing SOLDCOMPS_API_KEY GitHub Actions secret.");
 const month=new Date().toISOString().slice(0,7);
 let ledger=readJson(LEDGER_PATH,{month,automation_charged:0,runs:0,searches:0});
 if(ledger.month!==month)ledger={month,automation_charged:0,runs:0,searches:0};
 if(ledger.runs>=MAX_MONTHLY_RUNS||ledger.automation_charged+MAX_RUN_CREDITS>MONTHLY_AUTOMATION_CAP){console.log("Monthly collector cap reached; no searches made.");return;}
 const usage=await apiGet(`${API}/usage`);
 if(usage.plan!=="free")throw new Error(`Billing safety stop: expected free plan, API reports ${usage.plan}.`);
 if(!Number.isFinite(usage.remaining)||usage.remaining<MAX_RUN_CREDITS){console.log(`Free balance ${usage.remaining}; ${MAX_RUN_CREDITS} required for a worst-case run. No searches made.`);return;}
 const feed=readJson(FEED_PATH,{schema_version:1,updated_at:null,source:"SoldComps",records:[],runs:[]});
 const byItem=new Map((feed.records||[]).map(x=>[x.item_id,x]));
 const approved=readJson(APPROVED_PATH,{schema_version:1,updated_at:null,source:"SoldComps strict auto-accept",records:[]});
 const autoByItem=new Map((approved.records||[]).map(x=>[x.item_id,x]));
 const run={run_at:new Date().toISOString(),month,site:"EBAY_US",limit_per_search:LIMIT,status:"completed",searches:[],credits_charged:0,note:"Strict English PSA 10 matches may be auto-accepted; ambiguous and RAW results remain in manual review."};
 for(const p of PROFILES){
  const u=new URL(`${API}/sold`);u.searchParams.set("q",p.query);u.searchParams.set("site","EBAY_US");u.searchParams.set("days","90");u.searchParams.set("limit",String(LIMIT));
  try{
   const freshUsage=await apiGet(API+"/usage");
   const worstCaseRemaining=MAX_RUN_CREDITS-run.credits_charged;
   if(freshUsage.plan!=="free"||!Number.isFinite(freshUsage.remaining)||freshUsage.remaining<worstCaseRemaining){
    run.status="partial";
    run.searches.push({profile_id:p.id,query:p.query,status:"skipped",reason:"Free-tier guard: insufficient monthly credits for the remaining worst-case searches."});
    console.log("Budget guard stopped before "+p.id+"; no billable request made.");
    break;
   }
   const data=await apiGet(u);const charged=Number(data?.credits?.charged);
   if(!Number.isFinite(charged)||charged<20)throw new Error("Missing valid credits.charged in API response.");
   run.credits_charged+=charged;ledger.automation_charged+=charged;ledger.searches++;
   run.searches.push({profile_id:p.id,query:p.query,count:data.count??null,returned:data.returned??data.items?.length??0,credits_charged:charged,credits_remaining_reported:data.credits?.remaining??null,stats:data.stats??null,status:"success"});
   for(const item of data.items||[]){
    if(!item?.item_id)continue;
    const hint={profile_id:p.id,target_grade_hint:p.target_grade,card_id_hint:p.card_id,variant_id_hint:p.variant_id,query:p.query,collected_at:run.run_at};
    const prior=byItem.get(item.item_id);
    const autoPrior=autoByItem.get(item.item_id);
    if(prior){prior.matched_profiles||=[];if(!prior.matched_profiles.some(x=>x.profile_id===p.id))prior.matched_profiles.push(hint);prior.last_seen_at=run.run_at;prior.review_status="PENDING";}
    else if(autoPrior){
     autoByItem.delete(item.item_id);
     byItem.set(item.item_id,{...autoPrior,matched_profiles:[...(autoPrior.matched_profiles||[]),hint],review_flags:["MULTIPLE_PROFILE_MATCH_CONFLICT"],quality_tier:"HIGH_RISK",review_status:"PENDING",valuation_eligible:false,review_note:"Matched conflicting search profiles; removed from automatic acceptance."});
    }
    else {
     const record={item_id:item.item_id,source:'eBay via SoldComps',evidence_type:'DIRECT_TRANSACTION_CANDIDATE',marketplace:'eBay',currency:item.sold_price?.currency||data.stats?.currency||null,sold_price:item.sold_price?.value??null,sold_at:item.sold_at||null,title:item.title||'',condition_label:item.condition||null,buying_format:item.buying_format||null,best_offer_accepted:item.best_offer_accepted??null,best_offer_price_known:item.best_offer_price_known??null,shipping:item.shipping??null,url:item.url||null,flags:Array.isArray(item.flags)?item.flags:[],matched_profiles:[hint],first_seen_at:run.run_at,last_seen_at:run.run_at,review_note:'Automated checks are triage only. Confirm exact printing, language, grade, condition, sale and accepted price manually.'};
     const triage=assessListing(item,p),automatic=autoApprove(item,p);
     if(automatic.eligible){
      const accepted={...record,...triage,review_flags:[],quality_tier:"AUTO_APPROVED",review_status:"AUTO_APPROVED",valuation_eligible:true,auto_approval:{method:"STRICT_ENGLISH_PSA10_V1",approved_at:run.run_at,checks:["card name","set","card number","alt-art variant","English marker","PSA 10","sale date","price","currency","eBay URL"]},matched_profiles:[hint]};
      autoByItem.set(item.item_id,{...accepted,observation:toObservation(item,p)});
     } else {
      record.review_flags=[...new Set([...triage.review_flags,...automatic.flags])];record.quality_tier=record.review_flags.length?"NEEDS_REVIEW":"PRELIMINARY_MATCH";record.review_status="PENDING";record.valuation_eligible=false;byItem.set(item.item_id,record);
     }
    }
   }
   console.log(`OK ${p.id}: ${data.items?.length||0} returned; ${charged} credits.`);
  }catch(e){run.status="partial";run.searches.push({profile_id:p.id,query:p.query,status:"failed",error:e.message});console.error(`FAILED ${p.id}: ${e.message}`);}
 }
 ledger.runs++;ledger.last_run_at=run.run_at;ledger.last_reported_free_remaining=usage.remaining-run.credits_charged;
 feed.records=[...byItem.values()].sort((a,b)=>String(b.sold_at||"").localeCompare(String(a.sold_at||"")));feed.updated_at=run.run_at;
 approved.records=[...autoByItem.values()].sort((a,b)=>String(b.sold_at||"").localeCompare(String(a.sold_at||"")));approved.updated_at=run.run_at;feed.runs||=[];feed.runs.push(run);
 writeJson(LEDGER_PATH,ledger);writeJson(FEED_PATH,feed);writeJson(APPROVED_PATH,approved);
 console.log(`Run ${run.status}; charged ${run.credits_charged}; monthly automation total ${ledger.automation_charged}/${MONTHLY_AUTOMATION_CAP}; records in review queue ${feed.records.length}; auto-approved ${approved.records.length}.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
