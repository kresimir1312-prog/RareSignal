const API="https://api.tcgdex.net/v2/en";
const $=s=>document.querySelector(s);
const results=$("#results"), count=$("#result-count"), input=$("#query"), dlg=$("#detail"), body=$("#detail-body");
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function get(path){const r=await fetch(API+path);if(!r.ok)throw new Error("TCGdex returned "+r.status);return r.json();}
function empty(title,sub){results.innerHTML='<div class="empty"><b>⌕</b><strong>'+esc(title)+'</strong><span>'+esc(sub)+'</span></div>';}
async function search(){
 const q=input.value.trim();if(q.length<2){count.textContent="Enter at least two characters";return;}
 count.textContent="Searching…";empty("Searching the English catalogue","Loading matching card records from TCGdex.");
 try{
  const all=await get("/cards");
  const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const term=norm(q);
  const matches=all.filter(c=>norm(c.name).includes(term)||norm(c.id).includes(term)||norm(c.localId)===term).slice(0,32);
  count.textContent=matches.length+" matching card records";
  if(!matches.length){empty("No matching cards found","Try another Pokémon name, card name or collector number.");return;}
  results.innerHTML=matches.map(c=>'<article class="card" data-id="'+esc(c.id)+'" tabindex="0" role="button"><div class="art">'+(c.image?'<img loading="lazy" src="'+esc(c.image+'/high.png')+'" alt="'+esc(c.name)+'">':'<span>R</span>')+'</div><h3>'+esc(c.name)+'</h3><div class="meta">English catalogue · TCGdex</div><div class="id">'+esc(c.id)+' · #'+esc(c.localId)+'</div></article>').join("");
  results.querySelectorAll(".card").forEach(el=>{const open=()=>show(el.dataset.id);el.addEventListener("click",open);el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});
 }catch(e){count.textContent="Catalogue unavailable";empty("We couldn't load the catalogue",e.message+". Please try again.");}
}
async function show(id){
 body.innerHTML='<div class="detail-info"><p>Loading card identity…</p></div>';dlg.showModal();
 try{
  const c=await get("/cards/"+encodeURIComponent(id)), v=c.variants||{}, labels={firstEdition:"1st Edition",holo:"Holo",normal:"Normal",reverse:"Reverse Holo",wPromo:"W Promo"};
  const variant=Object.entries(v).filter(([,x])=>x===true).map(([k])=>labels[k]||k).join(" · ")||"Not provided";
  const image=c.image?c.image+"/high.png":"";
  const fields=[["TCGdex ID",c.id],["Set",c.set?.name],["Collector number",c.localId],["Category",c.category],["Rarity",c.rarity],["Illustrator",c.illustrator],["Catalogue variants",variant]];
  body.innerHTML='<div class="detail"><div class="detail-art">'+(image?'<img src="'+esc(image)+'" alt="'+esc(c.name)+'">':'No image')+'</div><div class="detail-info"><span class="kicker muted">ENGLISH CARD IDENTITY</span><h2>'+esc(c.name)+'</h2><p>Catalogue record supplied by TCGdex.</p>'+fields.map(([k,v])=>'<div class="detail-row"><span>'+esc(k)+'</span><span>'+esc(v||"Not provided")+'</span></div>').join("")+'<div class="warning">This confirms catalogue identity only. Verify exact printing, language and physical condition before comparing completed sales. No live market data is attached to this catalogue record.</div><a class="detail-estimate-link" href="#estimator" id="use-in-estimator">Use this card in the value estimator ↗</a></div></div>';
  $("#use-in-estimator").addEventListener("click",()=>{$("#estimate-card").value=c.name+" · "+(c.set?.name||"Set")+" · "+c.localId;dlg.close();document.querySelector("#estimator").scrollIntoView({behavior:"smooth"});});
 }catch(e){body.innerHTML='<div class="detail-info"><h2>Details unavailable</h2><p>'+esc(e.message)+'</p></div>';}
}
$("#search").addEventListener("click",search);input.addEventListener("keydown",e=>{if(e.key==="Enter")search();});
document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.q;search();}));
$("#close").addEventListener("click",()=>dlg.close());dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});

function parseSales(id){return $(id).value.split(/[\s,;]+/).map(Number).filter(n=>Number.isFinite(n)&&n>0);}
function median(a){const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;}
function money(n,cur){return new Intl.NumberFormat(undefined,{style:"currency",currency:cur,maximumFractionDigits:2}).format(n);}
function confidence(n30,n90){const n=n30+n90;return n>=30?"Higher sample":n>=15?"Moderate sample":n>=5?"Limited sample":"Very thin sample";}
function calculateEstimate(){
 const a=parseSales("#sales-30"),b=parseSales("#sales-90"),cur=$("#estimate-currency").value,market=$("#estimate-market").value,cond=$("#estimate-condition").value;
 const out=$("#estimate-output"),m30=median(a),m90=median(b),all=a.concat(b),mAll=median(all),low=all.length?Math.min(...all):null,high=all.length?Math.max(...all):null;
 if(!all.length){out.innerHTML='<div class="estimate-empty"><strong>No valid sale prices entered.</strong><span>Enter positive numeric completed-sale prices in one currency.</span></div>';return;}
 const trend=m30!==null&&m90!==null&&m90!==0?((m30-m90)/m90)*100:null;
 const trendText=trend===null?"Not enough data in both periods":(trend>0?"+":"")+trend.toFixed(1)+"% vs days 31–90";
 const n=all.length, conf=confidence(a.length,b.length);
 out.innerHTML='<div class="estimate-heading"><div><span class="kicker muted">COMPARABLE-SALE SUMMARY</span><h3>'+esc($("#estimate-card").value||"Selected card")+'</h3><p>'+esc(cond)+' · '+esc(market)+' · '+esc(cur)+' · completed sales only</p></div><span class="confidence">'+conf.toUpperCase()+'</span></div><div class="estimate-stats"><div><span>90-DAY MEDIAN</span><strong>'+money(mAll,cur)+'</strong><small>'+n+' sales entered</small></div><div><span>30-DAY MEDIAN</span><strong>'+(m30===null?"—":money(m30,cur))+'</strong><small>'+a.length+' sales</small></div><div><span>31–90 DAY MEDIAN</span><strong>'+(m90===null?"—":money(m90,cur))+'</strong><small>'+b.length+' sales</small></div><div><span>OBSERVED RANGE</span><strong>'+money(low,cur)+' – '+money(high,cur)+'</strong><small>Lowest to highest entered</small></div></div><div class="estimate-foot"><b>'+esc(trendText)+'</b><span>'+n+' total observations · '+esc(conf)+' · '+esc(cur)+' only; no currency conversion performed.</span></div><p class="estimate-disclaimer">This is a calculation of the prices you entered, not a verified market valuation. Reliability depends on exact printing, condition accuracy, sale dates, market coverage and source quality. Remove duplicates, lots, cancelled sales and outliers before relying on the median.</p>';
}
$("#calculate-estimate").addEventListener("click",calculateEstimate);

async function loadResearchSnapshot(){
 const host=$("#research-candidates");
 try{
  const r=await fetch("./data/research-snapshot-v3.9.json");
  if(!r.ok)throw new Error("Snapshot file unavailable");
  const data=await r.json();
  const auditResponse=await fetch("./data/identity-reconciliation-v3.9.json");
  const audit=auditResponse.ok?await auditResponse.json():{records:[]};
  const identityById=Object.fromEntries(audit.records.map(x=>[x.workbook_id,x]));
  host.innerHTML=data.cards.map(c=>{const identity=identityById[c.id]||{};const value=Number(c.raw_currency_value);const currency=String(c.raw_currency||"");return '<article class="candidate"><div class="candidate-top"><span>'+esc(c.set)+' · '+esc(c.number)+'</span><b>'+esc(c.status)+'</b></div><h4>'+esc(c.name)+'</h4><p class="candidate-print">'+esc(c.printing)+' · '+esc(c.finish)+'</p><p class="candidate-note">TCGdex: '+esc(identity.tcgdex_id||"Unresolved")+' · '+esc(identity.identity||"Pending")+'</p><div class="candidate-value">'+(Number.isFinite(value)?money(value,currency):"Not available")+' <small>historical raw reference</small></div><div class="candidate-meta">'+esc(c.raw_sales_count)+' NM sales · '+esc(c.snapshot_date)+' · '+esc(c.confidence)+' confidence · '+esc(currency)+' source currency</div><p class="candidate-note">'+esc(c.notes)+'</p><div class="candidate-sources">'+c.sources.map(s=>'<span>'+esc(s)+'</span>').join('')+'</div><div class="candidate-links">'+c.source_urls.map((u,i)=>'<a href="'+esc(u)+'" target="_blank" rel="noopener">Source '+(i+1)+' ↗</a>').join(' ')+'</div></article>';}).join("");
 }catch(e){host.innerHTML='<div class="candidate-loading">Research snapshot could not be loaded: '+esc(e.message)+'</div>';}
}
loadResearchSnapshot();
