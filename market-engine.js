/* RareSignal Market Intelligence Engine
 * Pure, dependency-free valuation functions. No market data is fetched or invented here.
 * All values remain separated by exact identity, condition, market and currency.
 */
(function(root){
 "use strict";
 const DAY=86400000;
 const VALID_GRADES=new Set(["RAW","PSA10"]);
 const VALID_STATUSES=new Set(["COMPLETED"]);
 const EVIDENCE_WEIGHTS={DIRECT_TRANSACTION:1,PROVIDER_REPORTED:0.55,AGGREGATE:0.25};
 const evidenceType=o=>{if(EVIDENCE_WEIGHTS[o.evidence_type])return o.evidence_type;if(o.source_url&&(/ebay\.[^/]+\/itm\//i.test(o.source_url)||/fanaticscollect\.com\/weekly\//i.test(o.source_url)))return "DIRECT_TRANSACTION";return "PROVIDER_REPORTED";};
 const marketplaceOf=o=>{if(o.marketplace)return String(o.marketplace).trim().toLowerCase();if(evidenceType(o)!=="DIRECT_TRANSACTION")return null;const u=String(o.source_url||"").toLowerCase();if(/ebay\./.test(u))return "ebay";if(/fanaticscollect\.com/.test(u))return "fanatics collect";return null;};
 const median=values=>{const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return !s.length?null:s.length%2?s[m]:(s[m-1]+s[m])/2;};
 const round=(n,d=2)=>n===null?null:Number(n.toFixed(d));
 const dateMs=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:null;};
 function validateObservation(o){
  const errors=[];
  if(!o||typeof o!=="object")return ["Observation must be an object."];
  ["sale_id","card_id","variant_id","sold_at","currency","market","source"].forEach(k=>{if(!String(o[k]??"").trim())errors.push("Missing "+k+".");});
  if(!VALID_GRADES.has(o.grade_type))errors.push("grade_type must be RAW or PSA10.");
  if(!VALID_STATUSES.has(o.sale_status))errors.push("Only completed sales are eligible.");
  if(!Number.isFinite(Number(o.price))||Number(o.price)<=0)errors.push("price must be a positive number.");
  if(dateMs(o.sold_at)===null)errors.push("sold_at must be a valid date.");
  if(o.grade_type==="RAW"&&!String(o.condition||"").trim())errors.push("Raw observations require an explicit condition.");
  if(o.grade_type==="PSA10"&&String(o.condition||"").toUpperCase()!=="PSA 10")errors.push("Graded observations must specify PSA 10 condition.");
  if(o.is_lot===true)errors.push("Lots are excluded.");
  if(o.evidence_type&&!Object.prototype.hasOwnProperty.call(EVIDENCE_WEIGHTS,o.evidence_type))errors.push("evidence_type must be DIRECT_TRANSACTION, PROVIDER_REPORTED or AGGREGATE.");
  if(o.evidence_type==="DIRECT_TRANSACTION"&&!String(o.source_url||"").trim())errors.push("Direct transaction evidence requires a source_url.");
  if(o.currency!==String(o.currency).toUpperCase())errors.push("Currency must use an uppercase ISO code.");
  return errors;
 }
 function groupKey(o){return [o.card_id,o.variant_id,o.grade_type,String(o.condition||"").toUpperCase(),o.market,String(o.currency).toUpperCase()].join("|");}
 function summarize(observations,options={}){
  const now=dateMs(options.as_of||new Date().toISOString());
  if(now===null)throw new Error("as_of must be a valid date.");
  const horizon30=now-30*DAY,horizon90=now-90*DAY;
  const seen=new Set(),accepted=[],excluded=[];
  for(const o of observations||[]){
   const errors=validateObservation(o);
   if(!errors.length&&seen.has(o.sale_id))errors.push("Duplicate sale_id.");
   if(!errors.length&&dateMs(o.sold_at)>now)errors.push("Future-dated sales are not eligible.");
   if(errors.length){excluded.push({sale_id:o&&o.sale_id||null,reasons:errors});continue;}
   seen.add(o.sale_id);accepted.push(o);
  }
  const groups=new Map();
  accepted.forEach(o=>{const k=groupKey(o);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);});
  const valuations=[...groups.entries()].map(([key,sales])=>{
   const dated=sales.map(o=>({...o,_date:dateMs(o.sold_at)})).sort((a,b)=>a._date-b._date);
   const recent=dated.filter(o=>o._date>=horizon30&&o._date<=now);
   const prior=dated.filter(o=>o._date>=horizon90&&o._date<horizon30);
   const last90=dated.filter(o=>o._date>=horizon90&&o._date<=now);
   const prices=last90.map(o=>Number(o.price)), med90=median(prices),med30=median(recent.map(o=>Number(o.price))),medPrior=median(prior.map(o=>Number(o.price)));
   const sources=[...new Set(last90.map(o=>o.source))],marketplaces=[...new Set(last90.map(marketplaceOf).filter(Boolean))],evidenceCounts={DIRECT_TRANSACTION:0,PROVIDER_REPORTED:0,AGGREGATE:0},weightedSales=last90.reduce((sum,o)=>{const t=evidenceType(o);evidenceCounts[t]++;return sum+EVIDENCE_WEIGHTS[t];},0),directSales=evidenceCounts.DIRECT_TRANSACTION,q1=median(prices.slice().sort((a,b)=>a-b).slice(0,Math.floor(prices.length/2))),q3=median(prices.slice().sort((a,b)=>a-b).slice(Math.ceil(prices.length/2)));
   const iqr=q1===null||q3===null?null:q3-q1;
   const trend=med30!==null&&medPrior!==null&&medPrior>0?round((med30-medPrior)/medPrior*100,1):null;
   const ageDays=dated.length?(now-dated[dated.length-1]._date)/DAY:null;
   const sampleScore=Math.min(40,weightedSales/20*40);
   const freshnessScore=ageDays===null?0:Math.max(0,20-Math.max(0,ageDays-7)*1.2);
   const diversityScore=Math.min(20,marketplaces.length/3*20);
   const consistencyScore=trend===null?5:Math.max(0,20-Math.min(20,Math.abs(trend)/2));
   const confidence=round(sampleScore+freshnessScore+diversityScore+consistencyScore,0);
   const first=sales[0];
   return {
    group_key:key,card_id:first.card_id,variant_id:first.variant_id,grade_type:first.grade_type,condition:first.condition||null,
    market:first.market,currency:first.currency,median_30d:round(med30),median_90d:round(med90),
    prior_30_90d_median:round(medPrior),trend_30d_vs_prior_percent:trend,
    sales_30d:recent.length,sales_90d:last90.length,weighted_sales_90d:round(weightedSales,2),direct_sales_90d:directSales,provider_reported_sales_90d:evidenceCounts.PROVIDER_REPORTED,aggregate_records_90d:evidenceCounts.AGGREGATE,evidence_counts_90d:evidenceCounts,source_count_90d:sources.length,sources_90d:sources,marketplace_count_90d:marketplaces.length,marketplaces_90d:marketplaces,
    range_90d:last90.length?{low:Math.min(...prices),high:Math.max(...prices)}:null,
    latest_sale_at:dated.length?dated[dated.length-1].sold_at:null,latest_sale_age_days:round(ageDays,1),
    confidence_score:confidence,confidence_band:confidence>=75?"HIGH":confidence>=50?"MEDIUM":"LOW",
    iqr_reference:iqr===null?null:{q1:round(q1),q3:round(q3),lower_fence:round(q1-1.5*iqr),upper_fence:round(q3+1.5*iqr)},
    outlier_review_count:iqr===null?0:prices.filter(p=>p<q1-1.5*iqr||p>q3+1.5*iqr).length,
    methodology:"Completed sales only; exact identity, condition, market and currency group; no FX conversion; IQR outliers flagged, not silently removed."
   };
  });
  return {as_of:new Date(now).toISOString(),accepted_count:accepted.length,excluded_count:excluded.length,valuations,excluded};
 }
 function investmentSignal(valuation,entryPrice){
  if(!valuation||!Number.isFinite(Number(entryPrice))||Number(entryPrice)<=0)return {signal:"INSUFFICIENT DATA",reason:"A positive observed entry price is required."};
  if(valuation.confidence_score<70||valuation.sales_90d<8||valuation.source_count_90d<2||valuation.median_90d===null)
   return {signal:"INSUFFICIENT DATA",reason:"Evidence threshold not met: require confidence ≥70, at least 8 comparable 90-day sales across 2 independent marketplaces and 3 directly verifiable transactions."};
  const upside=(valuation.median_90d-Number(entryPrice))/Number(entryPrice)*100;
  if(upside>=17&&!(valuation.trend_30d_vs_prior_percent!==null&&valuation.trend_30d_vs_prior_percent<=-15))
   return {signal:"BUY CANDIDATE",upside_percent:round(upside,1),reason:"Entry price is at least 17% below the 90-day median and the recent trend has not fallen 15% or more."};
  if(upside>=5)return {signal:"WATCH",upside_percent:round(upside,1),reason:"Some discount to the 90-day median, but the BUY threshold is not met."};
  if(upside<0)return {signal:"AVOID AT THIS PRICE",upside_percent:round(upside,1),reason:"Entry price is above the 90-day median."};
  return {signal:"HOLD / FAIR VALUE",upside_percent:round(upside,1),reason:"Entry price is close to the 90-day median."};
 }
 const api={validateObservation,summarize,investmentSignal,median,EVIDENCE_WEIGHTS};
 root.RareSignalMarketEngine=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
