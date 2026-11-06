const API="https://api.tcgdex.net/v2/en";
const $=s=>document.querySelector(s);
const results=$("#results"), count=$("#result-count"), input=$("#query"), dlg=$("#detail"), body=$("#detail-body");
const moreWrap=$("#prototype-load-more-wrap"), moreButton=$("#prototype-load-more");
const PAGE_SIZE=24;
let cataloguePromise=null, catalogue=[], filtered=[], visible=PAGE_SIZE, searchToken=0, detailToken=0;
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function get(path){const r=await fetch(API+path);if(!r.ok)throw new Error("TCGdex returned "+r.status);return r.json();}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
function empty(title,sub){results.innerHTML='<div class="empty"><b>⌕</b><strong>'+esc(title)+'</strong><span>'+esc(sub)+'</span></div>';moreWrap.hidden=true;}
async function loadCatalogue(){
 if(catalogue.length)return catalogue;
 if(!cataloguePromise)cataloguePromise=get("/cards").then(data=>{if(!Array.isArray(data))throw new Error("Unexpected catalogue response");catalogue=data;return data;}).catch(error=>{cataloguePromise=null;throw error;});
 return cataloguePromise;
}
function matches(c,q){
 const term=norm(q), name=norm(c.name), id=norm(c.id), local=norm(c.localId);
 const slash=term.match(/^(\d+)\s*\/\s*(\d+)$/);
 if(slash)return local===slash[1]||id.endsWith("-"+slash[1]);
 return name.includes(term)||id.includes(term)||local===term||id.endsWith("-"+term);
}
function renderResults(){
 const shown=filtered.slice(0,visible);
 count.textContent=filtered.length+" matching card records";
 results.innerHTML=shown.map(c=>'<article class="card" data-id="'+esc(c.id)+'" tabindex="0" role="button" aria-label="View '+esc(c.name)+'"><div class="art">'+(c.image?'<img loading="lazy" src="'+esc(c.image+'/high.png')+'" alt="'+esc(c.name)+' card image" onerror="this.style.display=\'none\'">':'<span>R</span>')+'</div><h3>'+esc(c.name)+'</h3><div class="meta">English catalogue · TCGdex</div><div class="id">'+esc(c.id)+' · #'+esc(c.localId)+'</div></article>').join("");
 results.querySelectorAll(".card").forEach(el=>{const open=()=>show(el.dataset.id);el.addEventListener("click",open);el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});
 moreWrap.hidden=visible>=filtered.length;
}
async function search(){
 const q=input.value.trim(), token=++searchToken;
 if(q.length<2){count.textContent="Enter at least two characters";empty("Start with a Pokémon or card number","Try a name such as Charizard or a collector number such as 20/124.");return;}
 count.textContent="Searching…";empty("Searching the English catalogue","Loading card records from TCGdex.");
 try{
  const all=await loadCatalogue();if(token!==searchToken)return;
  filtered=all.filter(c=>matches(c,q)).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  visible=PAGE_SIZE;
  if(!filtered.length){count.textContent="No matching card records";empty("No matching cards found","Try a Pokémon name, card name or collector number.");return;}
  renderResults();
 }catch(e){if(token!==searchToken)return;count.textContent="Catalogue unavailable";empty("We couldn't load the catalogue",e.message+". Please try again.");}
}
async function show(id){
 const token=++detailToken;
 body.innerHTML='<div class="detail-info"><p>Loading card identity…</p></div>';dlg.showModal();
 try{
  const c=await get("/cards/"+encodeURIComponent(id));if(token!==detailToken)return;
  const v=c.variants||{}, labels={firstEdition:"1st Edition",holo:"Holo",normal:"Normal",reverse:"Reverse Holo",wPromo:"W Promo"};
  const variant=Object.entries(v).filter(([,x])=>x===true).map(([k])=>labels[k]||k).join(" · ")||"Not provided";
  const image=c.image?c.image+"/high.png":"";
  const fields=[["TCGdex ID",c.id],["Set",c.set?.name],["Collector number",c.localId],["Category",c.category],["Rarity",c.rarity],["Illustrator",c.illustrator],["Catalogue variants",variant]];
  body.innerHTML='<div class="detail"><div class="detail-art">'+(image?'<img src="'+esc(image)+'" alt="'+esc(c.name)+' card image" onerror="this.style.display=\'none\'">':'No image')+'</div><div class="detail-info"><span class="kicker muted">ENGLISH CARD IDENTITY</span><h2>'+esc(c.name)+'</h2><p>Catalogue record supplied by TCGdex.</p>'+fields.map(([k,val])=>'<div class="detail-row"><span>'+esc(k)+'</span><span>'+esc(val||"Not provided")+'</span></div>').join("")+'<div class="warning">This confirms catalogue identity only. Verify exact printing, language and physical condition before comparing completed sales. No live market data is attached to this catalogue record.</div><a class="detail-estimate-link" href="#estimator" id="use-in-estimator">Use this card in the value estimator ↗</a></div></div>';
  $("#use-in-estimator").addEventListener("click",()=>{$("#estimate-card").value=c.name+" · "+(c.set?.name||"Set")+" · "+c.localId;dlg.close();document.querySelector("#estimator").scrollIntoView({behavior:"smooth",block:"start"});});
 }catch(e){if(token!==detailToken)return;body.innerHTML='<div class="detail-info"><h2>Details unavailable</h2><p>'+esc(e.message)+'</p></div>';}
}
$("#search").addEventListener("click",search);input.addEventListener("keydown",e=>{if(e.key==="Enter")search();});
document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.q;search();}));
moreButton.addEventListener("click",()=>{visible+=PAGE_SIZE;renderResults();});
$("#close").addEventListener("click",()=>dlg.close());dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});

function parseSales(id){return $(id).value.split(/[\s,;]+/).map(Number).filter(n=>Number.isFinite(n)&&n>0);}
function median(a){const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;}
function money(n,cur){return new Intl.NumberFormat(undefined,{style:"currency",currency:cur,maximumFractionDigits:2}).format(n);}
function confidence(n){return n>=30?"Higher sample":n>=15?"Moderate sample":n>=5?"Limited sample":"Very thin sample";}
function calculateEstimate(){
 const a=parseSales("#sales-30"),b=parseSales("#sales-90"),cur=$("#estimate-currency").value,market=$("#estimate-market").value,cond=$("#estimate-condition").value;
 const out=$("#estimate-output"),m30=median(a),m90=median(b),all=a.concat(b),mAll=median(all);
 if(!all.length){out.innerHTML='<div class="estimate-empty"><strong>No valid sale prices entered.</strong><span>Enter positive numeric completed-sale prices in one currency.</span></div>';return;}
 const low=Math.min(...all),high=Math.max(...all),trend=m30!==null&&m90!==null&&m90!==0?((m30-m90)/m90)*100:null;
 const trendText=trend===null?"Not enough data in both periods":(trend>0?"+":"")+trend.toFixed(1)+"% vs days 31–90",conf=confidence(all.length);
 out.innerHTML='<div class="estimate-heading"><div><span class="kicker muted">COMPARABLE-SALE SUMMARY</span><h3>'+esc($("#estimate-card").value||"Selected card")+'</h3><p>'+esc(cond)+' · '+esc(market)+' · '+esc(cur)+' · completed sales only</p></div><span class="confidence">'+conf.toUpperCase()+'</span></div><div class="estimate-stats"><div><span>90-DAY MEDIAN</span><strong>'+money(mAll,cur)+'</strong><small>'+all.length+' sales entered</small></div><div><span>30-DAY MEDIAN</span><strong>'+(m30===null?"—":money(m30,cur))+'</strong><small>'+a.length+' sales</small></div><div><span>31–90 DAY MEDIAN</span><strong>'+(m90===null?"—":money(m90,cur))+'</strong><small>'+b.length+' sales</small></div><div><span>OBSERVED RANGE</span><strong>'+money(low,cur)+' – '+money(high,cur)+'</strong><small>Lowest to highest entered</small></div></div><div class="estimate-foot"><b>'+esc(trendText)+'</b><span>'+all.length+' total observations · '+esc(conf)+' · '+esc(cur)+' only; no currency conversion performed.</span></div><p class="estimate-disclaimer">This is a calculation of the prices you entered, not a verified market valuation. Reliability depends on exact printing, condition accuracy, sale dates, market coverage and source quality. Remove duplicates, lots, cancelled sales and outliers before relying on the median.</p>';
}
$("#calculate-estimate").addEventListener("click",calculateEstimate);

let researchCards=[], researchIdentityById={};
function renderResearchCandidates(){
 const host=$("#research-candidates");
 const filter=$("#candidate-identity-filter")?.value||"all";
 const sort=$("#candidate-sort")?.value||"date";
 const visible=researchCards.filter(c=>{
  const identity=researchIdentityById[c.id]||{}, status=String(identity.identity||"PENDING");
  if(filter==="matched")return status==="MATCHED";
  if(filter==="variant")return status.includes("VARIANT_REVIEW");
  if(filter==="unresolved")return status==="UNRESOLVED";
  return true;
 });
 visible.sort((a,b)=>{
  if(sort==="name")return String(a.name).localeCompare(String(b.name));
  if(sort==="set")return String(a.set).localeCompare(String(b.set))||String(a.name).localeCompare(String(b.name));
  return String(b.snapshot_date||"").localeCompare(String(a.snapshot_date||""));
 });
 const count=$("#candidate-count");
 if(count)count.textContent=visible.length+" of "+researchCards.length+" candidates";
 host.innerHTML=visible.map(c=>{
  const identity=researchIdentityById[c.id]||{}, value=Number(c.raw_currency_value), currency=String(c.raw_currency||"");
  const validValue=c.raw_currency_value!==null&&c.raw_currency_value!==undefined&&Number.isFinite(value);
  const notes=String(c.notes||"").replace(/(?:No|no) EU delivered cost verified\.?/g,"").replace(/\s{2,}/g," ").trim();
  const status=String(identity.identity||"PENDING");
  const variantReview=status.includes("VARIANT_REVIEW");
  const statusLabel=status==="MATCHED"?"IDENTITY MATCHED":variantReview?"VARIANT REVIEW":status==="UNRESOLVED"?"UNRESOLVED":"PENDING";
  const statusClass=status==="MATCHED"?"":variantReview?" review":status==="UNRESOLVED"?" unresolved":" review";
  const tcgdexLink=identity.tcgdex_id?"<a class=\"candidate-tcgdex\" href=\"https://api.tcgdex.net/v2/en/cards/"+encodeURIComponent(identity.tcgdex_id)+"\" target=\"_blank\" rel=\"noopener noreferrer\">TCGdex "+esc(identity.tcgdex_id)+" ↗</a>":"";
  return '<article class="candidate"><div class="candidate-top"><span>'+esc(c.set)+' · '+esc(c.number)+'</span><b>'+esc(c.status||"HISTORICAL")+'</b></div><h4>'+esc(c.name)+'</h4><p class="candidate-print">'+esc(c.printing)+' · '+esc(c.finish)+'</p><div class="candidate-identity"><span class="identity-state'+statusClass+'">'+esc(statusLabel)+'</span>'+tcgdexLink+'</div><p class="candidate-variant">Catalogue variant: '+esc(identity.variant||"Not reconciled")+'</p><div class="candidate-value">'+(validValue?money(value,currency):"Not available")+' <small>historical raw reference</small></div><div class="candidate-meta">'+esc(c.raw_sales_count??"—")+' NM sales · '+esc(c.snapshot_date||"Date not recorded")+' · '+esc(c.confidence||"Unrated")+' confidence · '+esc(currency||"Currency unavailable")+'</div><p class="candidate-note">'+esc(notes)+'</p><div class="candidate-sources">'+(c.sources||[]).map(s=>'<span>'+esc(s)+'</span>').join('')+'</div><div class="candidate-links">'+(c.source_urls||[]).map((u,i)=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Source '+(i+1)+' ↗</a>').join(' ')+'</div></article>';
 }).join("")||'<div class="candidate-empty">No candidates match this identity filter.</div>';
}
async function loadResearchSnapshot(){
 const host=$("#research-candidates");
 try{
  const r=await fetch("./data/research-snapshot-v3.9.json");if(!r.ok)throw new Error("Snapshot file unavailable");
  const data=await r.json(), auditResponse=await fetch("./data/identity-reconciliation-v3.9.json");
  const audit=auditResponse.ok?await auditResponse.json():{records:[]};
  researchCards=data.cards||[];
  researchIdentityById=Object.fromEntries((audit.records||[]).map(x=>[x.workbook_id,x]));
  renderResearchCandidates();
 }catch(e){
  host.innerHTML='<div class="candidate-loading">Research snapshot could not be loaded: '+esc(e.message)+'</div>';
  const count=$("#candidate-count");if(count)count.textContent="Candidates unavailable";
 }
}
$("#candidate-identity-filter")?.addEventListener("change",renderResearchCandidates);
$("#candidate-sort")?.addEventListener("change",renderResearchCandidates);
loadResearchSnapshot();
