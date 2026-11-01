const API_BASE = "https://api.tcgdex.net/v2/en";
const PAGE_SIZE = 24;
let catalogue = null;
let sets = null;
let filteredCards = [];
let visibleCount = PAGE_SIZE;\nlet cataloguePromise = null;\nlet searchSequence = 0;\nlet detailSequence = 0;

const searchInput = document.querySelector("#card-search");
const searchButton = document.querySelector("#search-button");
const setFilter = document.querySelector("#set-filter");
const results = document.querySelector("#results");
const resultsCount = document.querySelector("#results-count");
const catalogueStatus = document.querySelector("#catalogue-status");
const loadMoreWrap = document.querySelector("#load-more-wrap");
const dialog = document.querySelector("#card-dialog");
const dialogContent = document.querySelector("#dialog-content");

document.querySelector("#year").textContent = new Date().getFullYear();

function setStatus(message) { catalogueStatus.textContent = message; }

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function normalise(value) {
  return String(value ?? "").toLocaleLowerCase("en").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`TCGdex request failed (${response.status})`);
  return response.json();
}

async function loadCatalogue() {
  if (catalogue) return catalogue;\n  if (cataloguePromise) return cataloguePromise;
  setStatus("Loading English catalogue…");
  searchButton.disabled = true;
  searchButton.textContent = "Loading…";
  try {
    const data = await apiGet("/cards");
    if (!Array.isArray(data)) throw new Error("Unexpected card catalogue response");
    catalogue = data;
    setStatus(`${catalogue.length.toLocaleString()} English card records available`);
    return catalogue;
  } catch (error) {
    cataloguePromise = null;\n    setStatus("Catalogue unavailable");
    results.innerHTML = `<div class="empty-state"><div class="empty-symbol">!</div><h3>We couldn't load the catalogue.</h3><p>${escapeHtml(error.message)}. Please try again shortly.</p></div>`;
    throw error;
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'Search cards <span>→</span>';
  }
}

async function loadSets() {
  if (sets) return sets;
  try {
    const data = await apiGet("/sets");
    if (!Array.isArray(data)) throw new Error("Unexpected set catalogue response");
    sets = data;
    const sorted = [...sets].sort((a,b) => (a.name || "").localeCompare(b.name || ""));
    setFilter.innerHTML = '<option value="">All sets</option>' + sorted.map(set =>
      `<option value="${escapeHtml(set.id)}">${escapeHtml(set.name)}${set.serie?.name ? ` — ${escapeHtml(set.serie.name)}` : ""}</option>`
    ).join("");
    return sets;
  } catch (error) {
    setStatus("Card catalogue available · set filters unavailable");
    return [];
  }
}

function matchesCard(card, term) {
  if (!term) return true;
  const q = normalise(term);
  const name = normalise(card.name);
  const id = normalise(card.id);
  const localId = normalise(card.localId);
  return name.includes(q) || id.includes(q) || localId === q || id.endsWith(`-${q}`);
}

function renderResults() {
  const cards = filteredCards.slice(0, visibleCount);
  resultsCount.textContent = `${filteredCards.length.toLocaleString()} matching card record${filteredCards.length === 1 ? "" : "s"}`;
  loadMoreWrap.hidden = visibleCount >= filteredCards.length;
  if (!cards.length) {
    results.innerHTML = '<div class="empty-state"><div class="empty-symbol">⌕</div><h3>No matching cards found.</h3><p>Try another spelling, collector number or set.</p></div>';
    return;
  }
  results.innerHTML = cards.map(card => {
    const image = card.image ? `${card.image}/high.png` : "";
    return `<article class="card-result" data-card-id="${escapeHtml(card.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(card.name)}">
      <div class="card-art">${image ? `<img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(card.name)} card image" onerror="this.style.display='none'">` : '<span class="art-placeholder">R</span>'}</div>
      <h3>${escapeHtml(card.name)}</h3>
      <div class="card-meta">English catalogue · TCGdex</div>
      <div class="card-number">${escapeHtml(card.id)} · #${escapeHtml(card.localId)}</div>
    </article>`;
  }).join("");
  results.querySelectorAll(".card-result").forEach(element => {
    const open = () => showCard(element.dataset.cardId);
    element.addEventListener("click", open);
    element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

async function searchCards() {
  const query = searchInput.value.trim();
  const selectedSet = setFilter.value;
  if (query.length === 1) {
    resultsCount.textContent = "Enter at least two characters, or choose a set";
    return;
  }
  if (!query && !selectedSet) {
    resultsCount.textContent = "Enter a card name or number, or choose a set";
    return;
  }
  results.innerHTML = '<div class="empty-state"><div class="empty-symbol">…</div><h3>Searching the catalogue</h3><p>Matching English card records.</p></div>';
  try {
    const cards = await loadCatalogue();
    filteredCards = cards.filter(card => matchesCard(card, query) && (!selectedSet || card.id.startsWith(selectedSet + "-")));
    filteredCards.sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    visibleCount = PAGE_SIZE;
    renderResults();
  } catch {
    resultsCount.textContent = "Search could not be completed";
  }
}

function variantSummary(card) {
  const variants = card.variants || {};
  const labels = {
    firstEdition: "1st Edition", holo: "Holo", normal: "Normal",
    reverse: "Reverse Holo", wPromo: "W Promo"
  };
  const found = Object.entries(variants).filter(([, value]) => value === true).map(([key]) => labels[key] || key);
  return found.length ? found.join(" · ") : "Variant details not provided";
}

function detailedVariants(card) {
  if (!Array.isArray(card.variants_detailed) || !card.variants_detailed.length) return "";
  return card.variants_detailed.map(variant => {
    const parts = [variant.type, variant.subtype, variant.size, variant.stamp, variant.foil].filter(Boolean);
    return parts.join(" / ");
  }).filter(Boolean).join("; ");
}

async function showCard(cardId) {
  dialogContent.innerHTML = '<div class="dialog-info"><p>Loading card details…</p></div>';
  dialog.showModal();
  try {
    const card = await apiGet(`/cards/${encodeURIComponent(cardId)}`);\n    if (sequence !== detailSequence) return;
    const image = card.image ? `${card.image}/high.png` : "";
    const setName = card.set?.name || "Set details unavailable";
    const rarity = card.rarity || "Not provided";
    const category = card.category || "Not provided";
    const illustrator = card.illustrator || "Not provided";
    const variantText = variantSummary(card);
    const detailed = detailedVariants(card);
    const release = card.set?.releaseDate || "Not provided";
    dialogContent.innerHTML = `<div class="dialog-layout">
      <div class="dialog-art">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(card.name)} card image" onerror="this.style.display='none'">` : '<span class="art-placeholder">R</span>'}</div>
      <div class="dialog-info">
        <span class="detail-label">ENGLISH CARD RECORD</span>
        <h2>${escapeHtml(card.name)}</h2>
        <p>${escapeHtml(setName)} · ${escapeHtml(card.localId || card.id)}</p>
        <div class="detail-list">
          <div class="detail-row"><span>Card ID</span><span>${escapeHtml(card.id)}</span></div>
          <div class="detail-row"><span>Collector number</span><span>${escapeHtml(card.localId || "Not provided")}</span></div>
          <div class="detail-row"><span>Category</span><span>${escapeHtml(category)}</span></div>
          <div class="detail-row"><span>Rarity</span><span>${escapeHtml(rarity)}</span></div>
          <div class="detail-row"><span>Illustrator</span><span>${escapeHtml(illustrator)}</span></div>
          <div class="detail-row"><span>Set release</span><span>${escapeHtml(release)}</span></div>
          <div class="detail-row"><span>Catalogue variants</span><span>${escapeHtml(variantText)}</span></div>
          ${detailed ? `<div class="detail-row"><span>Detailed finish data</span><span>${escapeHtml(detailed)}</span></div>` : ""}
        </div>
        <p class="source-note">Catalogue identity supplied by TCGdex. Variant fields describe catalogue metadata and do not independently verify every physical printing. No verified market price is currently attached.</p>
      </div>
    </div>`;
  } catch (error) {
    dialogContent.innerHTML = `<div class="dialog-info"><h2>Card details unavailable</h2><p>${escapeHtml(error.message)}</p></div>`;
  }
}

searchButton.addEventListener("click", searchCards);
searchInput.addEventListener("keydown", event => { if (event.key === "Enter") searchCards(); });
setFilter.addEventListener("change", searchCards);
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  setFilter.value = "";
  filteredCards = [];
  resultsCount.textContent = "Search the catalogue to begin";
  results.innerHTML = '<div class="empty-state"><div class="empty-symbol">⌕</div><h3>Your next discovery starts here.</h3><p>Search for a Pokémon or card name to explore catalogue records.</p></div>';
});
document.querySelectorAll("[data-query]").forEach(button => {
  button.addEventListener("click", () => { searchInput.value = button.dataset.query; searchCards(); });
});
document.querySelector("#load-more").addEventListener("click", () => { visibleCount += PAGE_SIZE; renderResults(); });
document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

loadSets();
