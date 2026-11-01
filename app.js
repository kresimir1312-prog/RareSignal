const API_BASE = "https://api.tcgdex.net/v2/en";
const PAGE_SIZE = 24;
let catalogue = null;
let filteredCards = [];
let visibleCount = PAGE_SIZE;

const searchInput = document.querySelector("#card-search");
const searchButton = document.querySelector("#search-button");
const results = document.querySelector("#results");
const resultsCount = document.querySelector("#results-count");
const catalogueStatus = document.querySelector("#catalogue-status");
const loadMoreWrap = document.querySelector("#load-more-wrap");
const dialog = document.querySelector("#card-dialog");
const dialogContent = document.querySelector("#dialog-content");

document.querySelector("#year").textContent = new Date().getFullYear();

function setStatus(message) {
  catalogueStatus.textContent = message;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

async function loadCatalogue() {
  if (catalogue) return catalogue;
  setStatus("Loading English catalogue…");
  searchButton.disabled = true;
  searchButton.textContent = "Loading…";
  try {
    const response = await fetch(`${API_BASE}/cards`);
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
    catalogue = await response.json();
    if (!Array.isArray(catalogue)) throw new Error("Unexpected catalogue response");
    setStatus(`${catalogue.length.toLocaleString()} English card records available`);
    return catalogue;
  } catch (error) {
    setStatus("Catalogue unavailable");
    results.innerHTML = `<div class="empty-state"><div class="empty-symbol">!</div><h3>We couldn't load the catalogue.</h3><p>${escapeHtml(error.message)}. Please try again shortly.</p></div>`;
    throw error;
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'Search cards <span>→</span>';
  }
}

function normalise(value) {
  return String(value ?? "").toLocaleLowerCase("en").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function matchesCard(card, term) {
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
    results.innerHTML = '<div class="empty-state"><div class="empty-symbol">⌕</div><h3>No matching cards found.</h3><p>Try another spelling, Pokémon name or collector number.</p></div>';
    return;
  }
  results.innerHTML = cards.map((card, index) => {
    const image = card.image ? `${card.image}/high.png` : "";
    return `<article class="card-result" data-card-id="${escapeHtml(card.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(card.name)}">
      <div class="card-art">${image ? `<img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(card.name)} card image" onerror="this.style.display='none'">` : '<span class="art-placeholder">R</span>'}</div>
      <h3>${escapeHtml(card.name)}</h3>
      <div class="card-meta">English catalogue · TCGdex</div>
      <div class="card-number">${escapeHtml(card.id)} · #${escapeHtml(card.localId)}</div>
    </article>`;
  }).join("");
  results.querySelectorAll(".card-result").forEach((element) => {
    const open = () => showCard(element.dataset.cardId);
    element.addEventListener("click", open);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

async function searchCards() {
  const query = searchInput.value.trim();
  if (query.length < 2) {
    resultsCount.textContent = "Enter at least two characters to search";
    return;
  }
  results.innerHTML = '<div class="empty-state"><div class="empty-symbol">…</div><h3>Searching the catalogue</h3><p>Matching English card records.</p></div>';
  try {
    const cards = await loadCatalogue();
    filteredCards = cards.filter((card) => matchesCard(card, query));
    filteredCards.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    visibleCount = PAGE_SIZE;
    renderResults();
  } catch {
    resultsCount.textContent = "Search could not be completed";
  }
}

async function showCard(cardId) {
  dialogContent.innerHTML = '<div class="dialog-info"><p>Loading card details…</p></div>';
  dialog.showModal();
  try {
    const response = await fetch(`${API_BASE}/cards/${encodeURIComponent(cardId)}`);
    if (!response.ok) throw new Error("Card details could not be loaded");
    const card = await response.json();
    const image = card.image ? `${card.image}/high.png` : "";
    const setName = card.set?.name || "Set details unavailable";
    const rarity = card.rarity || "Not provided";
    const types = Array.isArray(card.types) ? card.types.join(", ") : "Not provided";
    const variants = card.variants ? Object.entries(card.variants).filter(([, value]) => value === true).map(([key]) => key).join(", ") : "Not specified by catalogue";
    dialogContent.innerHTML = `<div class="dialog-layout">
      <div class="dialog-art">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(card.name)} card image" onerror="this.style.display='none'">` : '<span class="art-placeholder">R</span>'}</div>
      <div class="dialog-info">
        <span class="detail-label">ENGLISH CARD RECORD</span>
        <h2>${escapeHtml(card.name)}</h2>
        <p>${escapeHtml(setName)} · ${escapeHtml(card.localId || card.id)}</p>
        <div class="detail-list">
          <div class="detail-row"><span>Card ID</span><span>${escapeHtml(card.id)}</span></div>
          <div class="detail-row"><span>Collector number</span><span>${escapeHtml(card.localId || "Not provided")}</span></div>
          <div class="detail-row"><span>Rarity</span><span>${escapeHtml(rarity)}</span></div>
          <div class="detail-row"><span>Type</span><span>${escapeHtml(types)}</span></div>
          <div class="detail-row"><span>Variants</span><span>${escapeHtml(variants || "Not specified")}</span></div>
        </div>
        <p class="source-note">Catalogue identity supplied by TCGdex. This page does not yet contain verified market prices or investment advice.</p>
      </div>
    </div>`;
  } catch (error) {
    dialogContent.innerHTML = `<div class="dialog-info"><h2>Card details unavailable</h2><p>${escapeHtml(error.message)}</p></div>`;
  }
}

searchButton.addEventListener("click", searchCards);
searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") searchCards(); });
document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => { searchInput.value = button.dataset.query; searchCards(); });
});
document.querySelector("#load-more").addEventListener("click", () => { visibleCount += PAGE_SIZE; renderResults(); });
document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
