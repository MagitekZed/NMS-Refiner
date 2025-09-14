// NMS Refiner v0.2 — external JSON (with local fallback), listbox selectors, progression

const SEED_ITEMS = [
  { "id": "ferrite_dust", "name": "Ferrite Dust", "category": "element" },
  { "id": "pure_ferrite", "name": "Pure Ferrite", "category": "element" },
  { "id": "magnetised_ferrite", "name": "Magnetised Ferrite", "category": "element" },
  { "id": "carbon", "name": "Carbon", "category": "element" },
  { "id": "condensed_carbon", "name": "Condensed Carbon", "category": "element" },
  { "id": "sodium", "name": "Sodium", "category": "element" },
  { "id": "sodium_nitrate", "name": "Sodium Nitrate", "category": "element" },
  { "id": "oxygen", "name": "Oxygen", "category": "gas" },
  { "id": "kelp_sac", "name": "Kelp Sac", "category": "plant" },
  { "id": "ammonia", "name": "Ammonia", "category": "element" },
  { "id": "ionised_cobalt", "name": "Ionised Cobalt", "category": "element" },
  { "id": "gold", "name": "Gold", "category": "element" },
  { "id": "herox", "name": "Herox", "category": "alloy" }
];
const SEED_RECIPES = [
  { "id": "r_fd_to_pf", "inputs": [ { "itemId":"ferrite_dust", "qty":1 } ], "output": { "itemId":"pure_ferrite", "qty":1 }, "refinerSize":1, "timeSec": null, "notes": "" },
  { "id": "r_pf_to_mf", "inputs": [ { "itemId":"pure_ferrite", "qty":1 } ], "output": { "itemId":"magnetised_ferrite", "qty":1 }, "refinerSize":1, "timeSec": null, "notes": "" },
  { "id": "r_c_to_cc", "inputs": [ { "itemId":"carbon", "qty":2 } ], "output": { "itemId":"condensed_carbon", "qty":1 }, "refinerSize":1, "timeSec": null, "notes": "" },
  { "id": "r_cc_to_c", "inputs": [ { "itemId":"condensed_carbon", "qty":1 } ], "output": { "itemId":"carbon", "qty":2 }, "refinerSize":1, "timeSec": null, "notes": "" },
  { "id": "r_na_to_nn", "inputs": [ { "itemId":"sodium", "qty":2 } ], "output": { "itemId":"sodium_nitrate", "qty":1 }, "refinerSize":1, "timeSec": null, "notes": "" },
  { "id": "r_nn_to_na", "inputs": [ { "itemId":"sodium_nitrate", "qty":1 } ], "output": { "itemId":"sodium", "qty":2 }, "refinerSize":1, "timeSec": null, "notes": "" },
  { "id": "r_kelp_carbon_to_ox", "inputs": [ { "itemId":"kelp_sac", "qty":1 }, { "itemId":"carbon", "qty":1 } ], "output": { "itemId":"oxygen", "qty":2 }, "refinerSize":2, "timeSec": null, "notes": "Example 2-slot" },
  { "id": "r_herox", "inputs": [ { "itemId":"ammonia", "qty":1 }, { "itemId":"ionised_cobalt", "qty":1 }, { "itemId":"gold", "qty":1 } ], "output": { "itemId":"herox", "qty":1 }, "refinerSize":3, "timeSec": null, "notes": "Alloy example" }
];

let ITEMS = [];
let RECIPES = [];

let itemById = new Map();
let indexByItem = new Map();
let productIndex = new Map();
let pairIndex = new Map();
let byInputCount = { 1:new Set(), 2:new Set(), 3:new Set() };
let ALL_INPUT_ITEMS = [];
let ONE_SLOT_ADJ = new Map();

const state = {
  item1: null, item2: null, item3: null,
  product: null, productFilter: "", focusedInput: "item1",
};

const USE_SEED_FALLBACK = false; // set to false for production

async function loadData(){
  try{
    const [it, rc] = await Promise.all([
      fetch('data/items.json').then(r=>r.json()),
      fetch('data/recipes.json').then(r=>r.json())
    ]);
    ITEMS = it; RECIPES = rc;
  }catch(err){
    if (!USE_SEED_FALLBACK) throw err;
    ITEMS = SEED_ITEMS; RECIPES = SEED_RECIPES;
  }
  buildIndexes();
}


function buildIndexes(){
  itemById = new Map(ITEMS.map(i => [i.id, i]));
  indexByItem = new Map();
  productIndex = new Map();
  pairIndex = new Map();
  byInputCount = { 1:new Set(), 2:new Set(), 3:new Set() };

  RECIPES.forEach((r, idx) => {
    const len = r.inputs.length;
    if (byInputCount[len]) byInputCount[len].add(idx);

    r.inputs.forEach(inp => {
      if (!indexByItem.has(inp.itemId)) indexByItem.set(inp.itemId, new Set());
      indexByItem.get(inp.itemId).add(idx);
    });

    const out = r.output.itemId;
    if (!productIndex.has(out)) productIndex.set(out, new Set());
    productIndex.get(out).add(idx);

    const ids = r.inputs.map(x => x.itemId).sort();
    if (ids.length >= 2) {
      for (let i=0;i<ids.length;i++){
        for (let j=i+1;j<ids.length;j++){
          const key = `${ids[i]}|${ids[j]}`;
          if (!pairIndex.has(key)) pairIndex.set(key, new Set());
          pairIndex.get(key).add(idx);
        }
      }
    }
  });

  ALL_INPUT_ITEMS = Array.from(indexByItem.keys()).sort();
  ONE_SLOT_ADJ = buildOneSlotAdj();
}

const categoryClass = (id) => {
  const item = itemById.get(id);
  if (!item) return "";
  const c = item.category;
  if (c === "element") return "c-element";
  if (c === "gas") return "c-gas";
  if (c === "plant") return "c-plant";
  if (c === "alloy") return "c-alloy";
  if (c === "trade") return "c-trade";
  return "";
};
const canonicalKey = (ids) => ids.filter(Boolean).slice().sort().join("|");

function validItem2Options(item1Id){
  if (!item1Id) return [];
  const recipes = Array.from(indexByItem.get(item1Id) ?? []);
  const set = new Set();
  recipes.forEach(idx => {
    const r = RECIPES[idx];
    if (r.inputs.length >= 2){
      r.inputs.forEach(inp => { if (inp.itemId !== item1Id) set.add(inp.itemId); });
    }
  });
  return Array.from(set).sort();
}
function validItem3Options(item1Id, item2Id){
  if (!item1Id || !item2Id) return [];
  const key = canonicalKey([item1Id, item2Id]);
  const recipes = Array.from(pairIndex.get(key) ?? []);
  const set = new Set();
  recipes.forEach(idx => {
    const r = RECIPES[idx];
    if (r.inputs.length === 3){
      r.inputs.forEach(inp => {
        if (inp.itemId !== item1Id && inp.itemId !== item2Id) set.add(inp.itemId);
      });
    }
  });
  return Array.from(set).sort();
}
function resultsForSelection(item1Id, item2Id, item3Id){
  const sel = [item1Id, item2Id, item3Id].filter(Boolean);
  if (sel.length === 0) return [];
  const key = canonicalKey(sel);
  return RECIPES.filter(r => canonicalKey(r.inputs.map(x=>x.itemId)) === key);
}

/* Progression */
function buildOneSlotAdj(){
  const adj = new Map();
  RECIPES.forEach((r, idx) => {
    if (r.inputs.length === 1){
      const from = r.inputs[0].itemId;
      const to = r.output.itemId;
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from).push({ to, idx });
    }
  });
  return adj;
}
function computeLinearLadder(startId, maxSteps=6){
  const steps = [];
  if (!startId) return steps;
  let current = startId;
  const visited = new Set([current]);

  for (let i=0;i<maxSteps;i++){
    const outs = ONE_SLOT_ADJ.get(current) || [];
    const next = outs.length === 1 ? outs[0] : null;
    if (!next) break;
    if (visited.has(next.to)) break;
    steps.push(next.idx);
    current = next.to;
    visited.add(current);
  }
  return steps;
}

/* Render helpers */
const $ = (sel) => document.querySelector(sel);
function chip(id, qty=null, small=false){
  const cls = `chip ${categoryClass(id)} ${small ? "small" : ""}`;
  const label = itemById.get(id)?.name ?? id;
  const qtySpan = qty!=null ? ` <span class="qty">×${qty}</span>` : "";
  return `<span class="${cls}" data-id="${id}">${label}${qtySpan}</span>`;
}
function resultCard(recipe){
  const out = recipe.output;
  const outName = itemById.get(out.itemId)?.name ?? out.itemId;
  const inputs = recipe.inputs.map(i => chip(i.itemId, i.qty, true)).join('<span class="plus">+</span>');
  const meta = `${recipe.refinerSize}-slot${recipe.timeSec?` • ${recipe.timeSec}s`:""}`;
  return `<div class="result-card">
    <div class="result-title"><span class="product-name">${outName}</span><span class="qty-badge">× ${out.qty}</span></div>
    <div class="result-sub">${meta}</div>
    <div class="chips">${inputs}</div>
  </div>`;
}
function revCard(recipe){
  const out = recipe.output;
  const outName = itemById.get(out.itemId)?.name ?? out.itemId;
  const group = `${recipe.inputs.length}-slot`;
  const inputs = recipe.inputs.map(i => chip(i.itemId, i.qty, true)).join('<span class="plus">+</span>');
  return `<div class="rev-card">
    <h3 class="result-title"><span class="product-name">${outName}</span><span class="qty-badge">× ${out.qty}</span></h3>
    <div class="rev-sub">${group}${recipe.timeSec?` • ${recipe.timeSec}s`:""} • Use these inputs:</div>
    <div class="chips">${inputs}</div>
    <div class="actions"><button class="btn use-combo" data-id="${recipe.id}">Use these</button></div>
  </div>`;
}
function renderListbox(container, items, selectedId){
  if (!container) return;
  if (!items || items.length===0){
    container.innerHTML = `<div class="option empty">No valid options</div>`;
    return;
  }
  container.innerHTML = items.map(id => {
    const it = itemById.get(id);
    const sel = id===selectedId ? "selected" : "";
    return `<div class="option ${sel}" data-id="${id}">
      <span class="name">${it?.name ?? id}</span>
      <span class="badge ${categoryClass(id)}">${(it?.category ?? "").toUpperCase() || ""}</span>
    </div>`;
  }).join("");
}

/* Rendering */
function renderSelectors(){
  renderListbox($("#lb-item1"), ALL_INPUT_ITEMS, state.item1);

  const i2 = validItem2Options(state.item1);
  renderListbox($("#lb-item2"), i2, state.item2);
  if (!state.item1) state.item2 = null;

  const i3 = validItem3Options(state.item1, state.item2);
  renderListbox($("#lb-item3"), i3, state.item3);
  if (!state.item2) state.item3 = null;

  const b1 = $("#lb-item1"); if (b1) b1.querySelectorAll(".option:not(.empty)").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      state.item1 = id; state.item2 = null; state.item3 = null; state.focusedInput = "item1";
      rerender();
    });
  });
  const b2 = $("#lb-item2"); if (b2) b2.querySelectorAll(".option:not(.empty)").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      state.item2 = id; state.item3 = null; state.focusedInput = "item2";
      rerender();
    });
  });
  const b3 = $("#lb-item3"); if (b3) b3.querySelectorAll(".option:not(.empty)").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      state.item3 = id; state.focusedInput = "item3";
      rerender();
    });
  });

  document.querySelectorAll(".clear").forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute("data-clear");
      if (target==="item1"){ state.item1=null; state.item2=null; state.item3=null; state.focusedInput="item1"; }
      if (target==="item2"){ state.item2=null; state.item3=null; state.focusedInput="item1"; }
      if (target==="item3"){ state.item3=null; state.focusedInput = state.item2 ? "item2" : "item1"; }
      if (target==="product"){ state.product=null; state.productFilter=""; }
      rerender();
    };
  });
}
function renderResults(){
  const container = $("#results");
  const cards = resultsForSelection(state.item1, state.item2, state.item3).map(resultCard);
  container.innerHTML = cards.join("") || `<div class="result-sub">Pick inputs to see outputs.</div>`;
}
function renderReverse(){
  const lb = $("#lb-product");
  const filter = (state.productFilter||"").toLowerCase();
  let allProducts = Array.from(productIndex.keys()).sort();
  if (filter){ allProducts = allProducts.filter(id => (itemById.get(id)?.name||id).toLowerCase().includes(filter)); }
  renderListbox(lb, allProducts, state.product);

  if (lb) lb.querySelectorAll(".option:not(.empty)").forEach(el => {
    el.addEventListener("click", () => {
      state.product = el.getAttribute("data-id");
      drawReverseResults();
    });
  });
  drawReverseResults();

  const pf = $("#productFilter");
  if (pf){
    pf.value = state.productFilter;
    pf.oninput = () => { state.productFilter = pf.value; renderReverse(); };
  }
}
function drawReverseResults(){
  const container = $("#reverseResults");
  container.innerHTML = "";
  if (!state.product){
    container.innerHTML = `<div class="result-sub">Pick a product to see all input combinations.</div>`;
    return;
  }
  const recs = Array.from(productIndex.get(state.product) ?? []).map(idx => RECIPES[idx]);
  const groups = { 1:[], 2:[], 3:[] };
  recs.forEach(r => groups[r.inputs.length].push(r));
  const cards = []
    .concat(groups[1].map(revCard))
    .concat(groups[2].map(revCard))
    .concat(groups[3].map(revCard));
  container.innerHTML = cards.join("") || `<div class="result-sub">No recipes found for this product in dataset.</div>`;

  container.querySelectorAll(".use-combo").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const r = RECIPES.find(x => x.id === id);
      if (!r) return;
      const ids = r.inputs.map(i => i.itemId);
      state.item1 = ids[0] || null;
      state.item2 = ids[1] || null;
      state.item3 = ids[2] || null;
      state.focusedInput = "item1";
      rerender();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}
function updateLadderSub(){
  const label = state.focusedInput === "item1" ? "Item 1" : state.focusedInput === "item2" ? "Item 2" : "Item 3";
  $("#ladderSub").innerHTML = `Showing 1-slot steps from <strong>${label}</strong>`;
}
function renderLadder(){
  const container = $("#ladder");
  container.innerHTML = "";

  const selected = [state.item1, state.item2, state.item3].filter(Boolean);
  const selectedKey = canonicalKey(selected);
  const focusedId = (state.focusedInput==="item1" && state.item1) ? state.item1 :
                    (state.focusedInput==="item2" && state.item2) ? state.item2 :
                    (state.focusedInput==="item3" && state.item3) ? state.item3 : null;

  if (!focusedId){
    container.innerHTML = `<div class="result-sub">Pick ${state.focusedInput.replace("item","Item ")} to see its progression.</div>`;
    return;
  }

  const parts = [];

  if (selected.length === 1){
    const ladderIdxs = computeLinearLadder(focusedId, 6);
    let startIndex = 0;
    if (ladderIdxs.length>0){
      const first = RECIPES[ladderIdxs[0]];
      const firstKey = canonicalKey(first.inputs.map(x=>x.itemId));
      if (firstKey === canonicalKey([focusedId])) startIndex = 1;
    }
    for (let i=startIndex; i<ladderIdxs.length; i++){
      const rIdx = ladderIdxs[i];
      const r = RECIPES[rIdx];
      const from = r.inputs[0];
      const to = r.output;
      const title = `Progression ${parts.length+1}`;
      const meta = `${r.refinerSize}-slot${r.timeSec?` • ${r.timeSec}s`:""}`;
      const body = `
        <div class="chips">
          ${chip(from.itemId, from.qty, true)} <span class="plus">→</span> ${chip(to.itemId, to.qty, true)}
        </div>
        <div class="actions">
          <button class="btn use-output" data-id="${to.itemId}">Use Output as ${state.focusedInput === "item1" ? "Item 1" : state.focusedInput === "item2" ? "Item 2" : "Item 3"}</button>
        </div>
      `;
      parts.push(`
        <div class="step">
          <div class="rail"><div class="dot"></div><div class="line"></div></div>
          <div class="card">
            <div class="title">${title}</div>
            <div class="meta">${meta}</div>
            ${body}
          </div>
        </div>
      `);
    }
  }

  const supersetRecipes = [];
  RECIPES.forEach((r, idx) => {
    const inputIds = r.inputs.map(x=>x.itemId);
    const inSet = new Set(inputIds);
    const includesSelected = selected.every(s => inSet.has(s));
    const isExact = canonicalKey(inputIds) === selectedKey;
    if (includesSelected && !isExact){
      supersetRecipes.push(idx);
    }
  });
  supersetRecipes.forEach((idx) => {
    const r = RECIPES[idx];
    const title = `Progression ${parts.length+1}`;
    const meta = `${r.inputs.length}-slot${r.timeSec?` • ${r.timeSec}s`:""}`;
    const inputs = r.inputs.map(i => chip(i.itemId, i.qty, true)).join('<span class="plus">+</span>');
    const body = `
      <div class="chips">
        ${inputs} <span class="plus">→</span> ${chip(r.output.itemId, r.output.qty, true)}
      </div>
      <div class="actions">
        <button class="btn use-combo-ladder" data-id="${r.id}">Use this combo</button>
      </div>
    `;
    parts.push(`
      <div class="step">
        <div class="rail"><div class="dot"></div><div class="line"></div></div>
        <div class="card">
          <div class="title">${title}</div>
          <div class="meta">${meta}</div>
          ${body}
        </div>
      </div>
    `);
  });

  if (!parts.length){
    container.innerHTML = `<div class="result-sub">No additional paths from the current selection in dataset.</div>`;
  } else {
    container.innerHTML = parts.join("");
  }

  container.querySelectorAll(".use-output").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (state.focusedInput==="item1") state.item1 = id;
      else if (state.focusedInput==="item2") state.item2 = id;
      else state.item3 = id;
      rerender();
    });
  });
  container.querySelectorAll(".use-combo-ladder").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const rid = e.currentTarget.getAttribute("data-id");
      const r = RECIPES.find(x=>x.id===rid);
      if (!r) return;
      const ids = r.inputs.map(i=>i.itemId);
      state.item1 = ids[0]||null;
      state.item2 = ids[1]||null;
      state.item3 = ids[2]||null;
      state.focusedInput = "item1";
      rerender();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function bindFocus(){
  document.querySelectorAll(".focusable").forEach(el => {
    el.addEventListener("click", () => {
      state.focusedInput = el.getAttribute("data-focus");
      updateLadderSub();
      renderLadder();
    });
  });
}
function rerender(){
  renderSelectors();
  renderResults();
  renderReverse();
  updateLadderSub();
  renderLadder();
}
async function main(){
  await loadData();
  bindFocus();
  rerender();
}
document.addEventListener("DOMContentLoaded", main);

