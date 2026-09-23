let scripts = [];

const storageKey = "britedStudioV2ShotScripts";
let shotScriptIds = new Set(loadShotScriptIds());

const days = [
  { day: "02", weekday: "Mer" },
  { day: "03", weekday: "Jeu" },
  { day: "04", weekday: "Ven" },
  { day: "05", weekday: "Sam" },
  { day: "06", weekday: "Dim" },
  { day: "07", weekday: "Lun" },
  { day: "08", weekday: "Mar" },
  { day: "09", weekday: "Mer" },
  { day: "10", weekday: "Jeu" },
  { day: "11", weekday: "Ven" },
  { day: "12", weekday: "Sam" },
  { day: "13", weekday: "Dim" },
  { day: "14", weekday: "Lun" },
  { day: "15", weekday: "Mar" }
];

let activeDay = "all";
let activeTheme = "all";
let activeStatus = "all";
let activeShootingFilter = "all";
let activeSearch = "";
let activeScriptId = null;
let activeMode = "script";
let qualityMode = false;

const dayFilters = document.getElementById("dayFilters");
const scriptList = document.getElementById("scriptList");
const scriptDetail = document.getElementById("scriptDetail");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const countValue = document.getElementById("countValue");
const dateValue = document.getElementById("dateValue");
const themeValue = document.getElementById("themeValue");
const statusValue = document.getElementById("statusValue");
const shootingValue = document.getElementById("shootingValue");
const searchValue = document.getElementById("searchValue");

const summaryPanel = document.getElementById("summaryPanel");
const qualityPanel = document.getElementById("qualityPanel");
const qualityButton = document.getElementById("qualityButton");

const shootingOverlay = document.getElementById("shootingOverlay");
const shootingTitle = document.getElementById("shootingTitle");
const shootingMeta = document.getElementById("shootingMeta");
const shootingBody = document.getElementById("shootingBody");
const shootingShotButton = document.getElementById("shootingShotButton");

function loadShotScriptIds() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}

function saveShotScriptIds() {
  localStorage.setItem(storageKey, JSON.stringify([...shotScriptIds]));
}

function isScriptShot(scriptId) {
  return shotScriptIds.has(scriptId);
}

function renderDays() {
  const allButton = `
    <button class="day ${activeDay === "all" ? "active" : ""}" onclick="selectDay('all')">
      <div>
        <strong>Tous</strong>
        <span>Dates</span>
      </div>
    </button>
  `;

  const dayButtons = days.map((item) => `
    <button class="day ${item.day === activeDay ? "active" : ""}" onclick="selectDay('${item.day}')">
      <div>
        <strong>${item.day}</strong>
        <span>${item.weekday}</span>
      </div>
    </button>
  `).join("");

  dayFilters.innerHTML = allButton + dayButtons;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isReadyStatus(script) {
  const status = normalizeText(script.status);
  return status.includes("pret") || status.includes("valide");
}

function isToValidateStatus(script) {
  const status = normalizeText(script.status);
  return status.includes("valider") || status.includes("validation") || status.includes("relire");
}

function matchesStatusFilter(script) {
  if (activeStatus === "all") return true;
  if (activeStatus === "toValidate") return isToValidateStatus(script);
  if (activeStatus === "ready") return isReadyStatus(script);
  return true;
}

function matchesShootingFilter(script) {
  const shot = isScriptShot(script.id);

  if (activeShootingFilter === "all") return true;
  if (activeShootingFilter === "shot") return shot;
  if (activeShootingFilter === "notShot") return !shot;

  return true;
}

function filteredScripts() {
  const query = normalizeText(activeSearch);

  return scripts.filter((script) => {
    const dayOk = activeDay === "all" || script.day === activeDay;
    const themeOk = activeTheme === "all" || script.theme === activeTheme;
    const statusOk = matchesStatusFilter(script);
    const shootingOk = matchesShootingFilter(script);

    const searchableText = normalizeText([
      script.title,
      script.summary,
      script.theme,
      script.category,
      script.target,
      script.conclusion,
      script.status,
      script.natural,
      script.day,
      script.weekday,
      script.time,
      script.duration,
      script.notes?.intention,
      script.notes?.rythme,
      script.notes?.vigilance,
      ...(script.body || [])
    ].join(" "));

    const searchOk = !query || searchableText.includes(query);

    return dayOk && themeOk && statusOk && shootingOk && searchOk;
  });
}

function getDateLabel() {
  if (activeDay === "all") return "Toutes dates";
  const day = days.find((item) => item.day === activeDay);
  return day ? `${day.day} ${day.weekday}` : activeDay;
}

function getThemeLabel() {
  const labels = {
    all: "Tous",
    investir: "Investir",
    fiscalite: "Fiscalité",
    epargne: "Épargne"
  };

  return labels[activeTheme] || activeTheme;
}

function getStatusLabel() {
  const labels = {
    all: "Tous",
    toValidate: "À valider",
    ready: "Prêts"
  };

  return labels[activeStatus] || "Tous";
}

function getShootingLabel() {
  const labels = {
    all: "Tous",
    shot: "Tournés",
    notShot: "Non tournés"
  };

  return labels[activeShootingFilter] || "Tous";
}

function getStatusCounts() {
  let ready = 0;
  let toValidate = 0;

  scripts.forEach((script) => {
    if (isReadyStatus(script)) ready += 1;
    if (isToValidateStatus(script)) toValidate += 1;
  });

  return { ready, toValidate };
}

function getShootingCounts() {
  const total = scripts.length;
  const shot = scripts.filter((script) => isScriptShot(script.id)).length;
  const notShot = total - shot;

  return { total, shot, notShot };
}

function renderSummaryPanel() {
  const total = scripts.length;
  const investir = scripts.filter((script) => script.theme === "investir").length;
  const fiscalite = scripts.filter((script) => script.theme === "fiscalite").length;
  const epargne = scripts.filter((script) => script.theme === "epargne").length;
  const statusCounts = getStatusCounts();
  const shootingCounts = getShootingCounts();

  summaryPanel.innerHTML = `
    <div class="summary-head">
      <div>
        <h3>Synthèse automatique</h3>
        <p>Vue globale de la bibliothèque complète, avec suivi local du tournage.</p>
      </div>
      <span class="summary-refresh">Mise à jour automatique</span>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <span>Total scripts</span>
        <strong>${total}</strong>
        <small>Bibliothèque complète</small>
      </div>

      <div class="summary-card">
        <span>Investir</span>
        <strong>${investir}</strong>
        <small>Scripts patrimoine et allocation</small>
      </div>

      <div class="summary-card">
        <span>Fiscalité</span>
        <strong>${fiscalite}</strong>
        <small>Scripts impôt et optimisation</small>
      </div>

      <div class="summary-card">
        <span>Épargne</span>
        <strong>${epargne}</strong>
        <small>Scripts budget et placement</small>
      </div>

      <div class="summary-card gold">
        <span>À valider</span>
        <strong>${statusCounts.toValidate}</strong>
        <small>Scripts à relire</small>
      </div>

      <div class="summary-card">
        <span>Prêts</span>
        <strong>${statusCounts.ready}</strong>
        <small>Scripts validés ou prêts</small>
      </div>

      <div class="summary-card blue">
        <span>Tournés</span>
        <strong>${shootingCounts.shot}</strong>
        <small>Scripts déjà enregistrés</small>
      </div>

      <div class="summary-card blue">
        <span>Restants</span>
        <strong>${shootingCounts.notShot}</strong>
        <small>Scripts encore à tourner</small>
      </div>
    </div>

    <div class="summary-actions">
      <button class="summary-filter-button gold ${activeStatus === "toValidate" ? "active" : ""}" onclick="selectStatusFilter('toValidate')">
        Voir uniquement les scripts à valider
      </button>

      <button class="summary-filter-button ${activeStatus === "ready" ? "active" : ""}" onclick="selectStatusFilter('ready')">
        Voir uniquement les scripts prêts
      </button>

      <button class="summary-filter-button ${activeStatus === "all" ? "active" : ""}" onclick="selectStatusFilter('all')">
        Voir tous les statuts
      </button>
    </div>

    <div class="summary-actions">
      <button class="tracking-filter-button blue ${activeShootingFilter === "notShot" ? "active" : ""}" onclick="selectShootingFilter('notShot')">
        Voir uniquement les non tournés
      </button>

      <button class="tracking-filter-button blue ${activeShootingFilter === "shot" ? "active" : ""}" onclick="selectShootingFilter('shot')">
        Voir uniquement les tournés
      </button>

      <button class="tracking-filter-button ${activeShootingFilter === "all" ? "active" : ""}" onclick="selectShootingFilter('all')">
        Voir tous les tournages
      </button>
    </div>
  `;
}

function updateControlPanel(count) {
  countValue.textContent = `${count} script${count > 1 ? "s" : ""}`;
  dateValue.textContent = getDateLabel();
  themeValue.textContent = getThemeLabel();
  statusValue.textContent = getStatusLabel();
  shootingValue.textContent = getShootingLabel();
  searchValue.textContent = activeSearch.trim() ? activeSearch.trim() : "Aucune";
}

function renderQualityPanel(items) {
  qualityPanel.classList.toggle("active", qualityMode);
  qualityButton.classList.toggle("active", qualityMode);
  qualityButton.textContent = qualityMode ? "Masquer le contrôle qualité" : "Mode contrôle qualité";

  if (!qualityMode) {
    qualityPanel.innerHTML = "";
    return;
  }

  if (!items.length) {
    qualityPanel.innerHTML = `
      <div class="quality-head">
        <div>
          <h3>Contrôle qualité</h3>
          <p>Aucun script ne correspond aux filtres actuels.</p>
        </div>
        <span class="quality-count">0 script</span>
      </div>
    `;
    return;
  }

  const cards = items.map((script) => `
    <div class="quality-card">
      <div class="quality-title">
        <span>Titre</span>
        <strong>${script.title}</strong>
        <small>${script.day} ${script.weekday} · ${script.time}</small>
      </div>

      <div class="quality-field">
        <span>Thème</span>
        <strong>${script.category}</strong>
      </div>

      <div class="quality-field">
        <span>Statut</span>
        <strong>${script.status}</strong>
      </div>

      <div class="quality-field">
        <span>Tournage</span>
        <strong>${isScriptShot(script.id) ? "Tourné" : "Non tourné"}</strong>
      </div>

      <div class="quality-note">
        <strong>Intention :</strong> ${script.notes?.intention || "Non renseignée"}<br>
        <strong>Rythme :</strong> ${script.notes?.rythme || "Non renseigné"}<br>
        <strong>Vigilance :</strong> ${script.notes?.vigilance || "Non renseignée"}
      </div>
    </div>
  `).join("");

  qualityPanel.innerHTML = `
    <div class="quality-head">
      <div>
        <h3>Contrôle qualité</h3>
        <p>Vue rapide des scripts visibles avec leurs informations de relecture et de tournage.</p>
      </div>
      <span class="quality-count">${items.length} script${items.length > 1 ? "s" : ""}</span>
    </div>

    <div class="quality-grid">
      ${cards}
    </div>
  `;
}

function renderList() {
  const items = filteredScripts();

  renderSummaryPanel();
  updateControlPanel(items.length);
  renderQualityPanel(items);

  if (!items.length) {
    scriptList.innerHTML = "";
    emptyState.style.display = "block";
    emptyState.textContent = activeSearch
      ? "Aucun script ne correspond à cette recherche avec les filtres actuels."
      : "Aucun script ne correspond à ce filtre pour le moment.";
    scriptDetail.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  scriptDetail.style.display = "block";

  if (!items.find((script) => script.id === activeScriptId)) {
    activeScriptId = items[0].id;
  }

  scriptList.innerHTML = items.map((script) => {
    const shot = isScriptShot(script.id);

    return `
      <button class="list-card ${script.id === activeScriptId ? "active" : ""} ${shot ? "shot" : ""}" onclick="selectScript('${script.id}')">
        <div class="list-meta">
          <span class="list-time">${activeDay === "all" ? `${script.day} ${script.weekday} · ${script.time}` : script.time}</span>
          <span class="list-status">${script.status}</span>
          ${shot ? `<span class="shot-badge">Tourné</span>` : ""}
        </div>
        <h3>${script.title}</h3>
        <p>${script.summary}</p>
      </button>
    `;
  }).join("");

  renderDetail();
}

function renderDetail() {
  const script = scripts.find((item) => item.id === activeScriptId);
  if (!script) return;

  const shot = isScriptShot(script.id);
  const bodyHtml = script.body.map((paragraph) => `<p>${paragraph}</p>`).join("");

  scriptDetail.innerHTML = `
    <div class="script-top">
      <div class="badges">
        <span class="badge time">${script.day} ${script.weekday} · ${script.time}</span>
        <span class="badge status">${script.status}</span>
        <span class="badge natural">${script.natural}</span>
        ${shot ? `<span class="badge shot">Tourné</span>` : `<span class="badge shot">Non tourné</span>`}
      </div>

      <div class="script-buttons">
        <button class="copy" onclick="copyCurrentScript()">Copier le texte</button>
        <button class="shot-button ${shot ? "active" : ""}" onclick="toggleCurrentScriptShot()">
          ${shot ? "Annuler tourné" : "Marquer comme tourné"}
        </button>
        <button class="shooting-button" onclick="openShootingMode()">Mode tournage</button>
      </div>
    </div>

    <h3 class="script-title">${script.title}</h3>

    <div class="meta-box">
      <strong>${script.category}</strong><br>
      <strong>Pour :</strong> ${script.target}<br>
      <strong>Phrase finale :</strong> ${script.conclusion}
    </div>

    <div class="duration">
      <strong>${script.duration}</strong><br>
      Texte pensé pour une lecture face caméra. Durée à confirmer à voix haute.
    </div>

    <div class="mode-tabs">
      <button class="mode-tab ${activeMode === "script" ? "active" : ""}" onclick="setMode('script')">Lecture face caméra</button>
      <button class="mode-tab ${activeMode === "notes" ? "active" : ""}" onclick="setMode('notes')">Notes de tournage</button>
    </div>

    <div class="script-body ${activeMode === "notes" ? "hidden" : ""}" id="currentScriptBody">
      ${bodyHtml}
    </div>

    <div class="notes ${activeMode === "notes" ? "active" : ""}">
      <div class="notes-grid">
        <div class="note-card">
          <strong>Intention</strong>
          <p>${script.notes.intention}</p>
        </div>
        <div class="note-card">
          <strong>Rythme</strong>
          <p>${script.notes.rythme}</p>
        </div>
        <div class="note-card">
          <strong>Vigilance</strong>
          <p>${script.notes.vigilance}</p>
        </div>
      </div>
    </div>

    <div class="script-actions">
      <details>
        <summary>Sources et précisions <span>+</span></summary>
        <div>${script.sources}</div>
      </details>

      <details>
        <summary>Afficher le guide de tournage complet <span>+</span></summary>
        <div>${script.guide}</div>
      </details>

      <div class="warning">
        Texte à valider avant tournage. Vérifiez le fond, les chiffres et l’adéquation avec votre pratique professionnelle.
      </div>
    </div>
  `;
}

function selectDay(day) {
  activeDay = day;
  activeMode = "script";
  renderDays();
  renderList();
}

function selectScript(id) {
  activeScriptId = id;
  activeMode = "script";
  renderList();
}

function setMode(mode) {
  activeMode = mode;
  renderDetail();
}

function selectStatusFilter(status) {
  activeStatus = status;
  activeMode = "script";
  renderList();
}

function selectShootingFilter(filter) {
  activeShootingFilter = filter;
  activeMode = "script";
  renderList();
}

function toggleQualityMode() {
  qualityMode = !qualityMode;
  renderList();

  if (qualityMode) {
    qualityPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function toggleCurrentScriptShot() {
  const script = scripts.find((item) => item.id === activeScriptId);
  if (!script) return;

  if (shotScriptIds.has(script.id)) {
    shotScriptIds.delete(script.id);
    showToast("Script marqué comme non tourné");
  } else {
    shotScriptIds.add(script.id);
    showToast("Script marqué comme tourné");
  }

  saveShotScriptIds();

  if (shootingOverlay.classList.contains("active")) {
    updateShootingShotButton();
  }

  renderList();
}

function updateShootingShotButton() {
  const script = scripts.find((item) => item.id === activeScriptId);
  if (!script) return;

  const shot = isScriptShot(script.id);
  shootingShotButton.textContent = shot ? "Annuler tourné" : "Marquer comme tourné";
}

function openShootingMode() {
  const script = scripts.find((item) => item.id === activeScriptId);
  if (!script) return;

  shootingTitle.textContent = script.title;
  shootingMeta.textContent = `${script.day} ${script.weekday} · ${script.time} · ${script.category} · ${script.duration}`;
  shootingBody.innerHTML = script.body.map((paragraph) => `<p>${paragraph}</p>`).join("");

  updateShootingShotButton();

  shootingOverlay.classList.add("active");
  shootingOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  shootingOverlay.scrollTop = 0;
}

function closeShootingMode() {
  shootingOverlay.classList.remove("active");
  shootingOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function resetFilters() {
  activeDay = "all";
  activeTheme = "all";
  activeStatus = "all";
  activeShootingFilter = "all";
  activeSearch = "";
  activeMode = "script";
  qualityMode = false;
  searchInput.value = "";

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.theme === "all");
  });

  renderDays();
  renderList();
}

function formatScriptForCopy(script, index = null) {
  const number = index !== null ? `${index + 1}. ` : "";
  const shotLabel = isScriptShot(script.id) ? "Tourné" : "Non tourné";

  return [
    `${number}${script.title}`,
    `${script.day} ${script.weekday} · ${script.time}`,
    `${script.category}`,
    `Statut : ${script.status}`,
    `Tournage : ${shotLabel}`,
    "",
    script.body.join("\n\n"),
    "",
    `Intention : ${script.notes.intention}`,
    `Rythme : ${script.notes.rythme}`,
    `Vigilance : ${script.notes.vigilance}`,
    "",
    `Sources : ${script.sources}`,
    "----------------------------------------"
  ].join("\n");
}

function buildExportForItems(items, title) {
  if (!items.length) {
    return {
      items,
      text: ""
    };
  }

  const header = [
    title,
    `Date : ${getDateLabel()}`,
    `Thème : ${getThemeLabel()}`,
    `Statut : ${getStatusLabel()}`,
    `Tournage : ${getShootingLabel()}`,
    `Recherche : ${activeSearch.trim() ? activeSearch.trim() : "Aucune"}`,
    `Nombre : ${items.length} script${items.length > 1 ? "s" : ""}`,
    "========================================"
  ].join("\n");

  const body = items.map((script, index) => formatScriptForCopy(script, index)).join("\n\n");

  return {
    items,
    text: `${header}\n\n${body}`
  };
}

function buildVisibleScriptsExport() {
  return buildExportForItems(filteredScripts(), "BRITED Studio — Scripts affichés");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

function copyCurrentScript() {
  const script = scripts.find((item) => item.id === activeScriptId);
  if (!script) return;

  const text = script.body.join("\n\n");

  navigator.clipboard.writeText(text).then(() => {
    showToast("Script copié");
  });
}

function copyVisibleScripts() {
  const exportData = buildVisibleScriptsExport();

  if (!exportData.items.length) {
    showToast("Aucun script à copier");
    return;
  }

  navigator.clipboard.writeText(exportData.text).then(() => {
    showToast(`${exportData.items.length} script${exportData.items.length > 1 ? "s" : ""} copiés`);
  });
}

function createSafeFilename(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function downloadTextFile(text, filename, count) {
  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  showToast(`${count} script${count > 1 ? "s" : ""} exportés`);
}

function downloadVisibleScripts() {
  const exportData = buildVisibleScriptsExport();

  if (!exportData.items.length) {
    showToast("Aucun script à exporter");
    return;
  }

  const datePart = createSafeFilename(getDateLabel());
  const themePart = createSafeFilename(getThemeLabel());
  const statusPart = createSafeFilename(getStatusLabel());
  const shootingPart = createSafeFilename(getShootingLabel());
  const searchPart = activeSearch.trim()
    ? `-${createSafeFilename(activeSearch.trim())}`
    : "";

  const filename = `brited-studio-scripts-${datePart}-${themePart}-${statusPart}-${shootingPart}${searchPart}.txt`;

  downloadTextFile(exportData.text, filename, exportData.items.length);
}

function downloadShotScripts(type) {
  const previousFilter = activeShootingFilter;
  activeShootingFilter = type;

  const items = filteredScripts();
  const title = type === "shot"
    ? "BRITED Studio — Scripts tournés"
    : "BRITED Studio — Scripts non tournés";

  const exportData = buildExportForItems(items, title);

  activeShootingFilter = previousFilter;

  if (!exportData.items.length) {
    showToast(type === "shot" ? "Aucun script tourné à exporter" : "Aucun script non tourné à exporter");
    return;
  }

  const datePart = createSafeFilename(getDateLabel());
  const themePart = createSafeFilename(getThemeLabel());
  const statusPart = createSafeFilename(getStatusLabel());
  const typePart = type === "shot" ? "tournes" : "non-tournes";
  const searchPart = activeSearch.trim()
    ? `-${createSafeFilename(activeSearch.trim())}`
    : "";

  const filename = `brited-studio-${typePart}-${datePart}-${themePart}-${statusPart}${searchPart}.txt`;

  downloadTextFile(exportData.text, filename, exportData.items.length);
}

function scrollToScripts() {
  document.getElementById("scripts").scrollIntoView({ behavior: "smooth" });
}

searchInput.addEventListener("input", () => {
  activeSearch = searchInput.value;
  activeMode = "script";
  renderList();
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
    activeTheme = chip.dataset.theme;
    activeMode = "script";
    renderList();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && shootingOverlay.classList.contains("active")) {
    closeShootingMode();
  }
});

async function loadScripts() {
  try {
    emptyState.style.display = "block";
    emptyState.textContent = "Chargement des scripts...";

    const response = await fetch("data/scripts.json");

    if (!response.ok) {
      throw new Error("Impossible de charger data/scripts.json");
    }

    scripts = await response.json();

    if (!scripts.length) {
      throw new Error("Le fichier scripts.json est vide");
    }

    activeScriptId = scripts[0].id;
    renderSummaryPanel();
    renderDays();
    renderList();
  } catch (error) {
    console.error(error);
    scriptList.innerHTML = "";
    summaryPanel.innerHTML = "";
    emptyState.style.display = "block";
    emptyState.textContent = "Impossible de charger les scripts. Vérifiez le fichier data/scripts.json.";
    scriptDetail.style.display = "none";
    updateControlPanel(0);
  }
}

renderDays();
loadScripts();
