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
  body.innerHTML='<div class="detail"><div class="detail-art">'+(image?'<img src="'+esc(image)+'" alt="'+esc(c.name)+'">':'No image')+'</div><div class="detail-info"><span class="kicker muted">ENGLISH CARD IDENTITY</span><h2>'+esc(c.name)+'</h2><p>Catalogue record supplied by TCGdex.</p>'+fields.map(([k,v])=>'<div class="detail-row"><span>'+esc(k)+'</span><span>'+esc(v||"Not provided")+'</span></div>').join("")+'<div class="warning">Catalogue metadata does not verify physical condition, authenticity or current market value. No price or investment signal is attached.</div></div></div>';
 }catch(e){body.innerHTML='<div class="detail-info"><h2>Details unavailable</h2><p>'+esc(e.message)+'</p></div>';}
}
$("#search").addEventListener("click",search);input.addEventListener("keydown",e=>{if(e.key==="Enter")search();});
document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.q;search();}));
$("#close").addEventListener("click",()=>dlg.close());dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close();});
