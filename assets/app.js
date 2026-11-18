let scripts = [];

const storageKey = "britedStudioV2ShotScripts";
let shotScriptIds = new Set(loadShotScriptIds());


let activeTheme = "all";
let activeStatus = "all";
let activeShootingFilter = "all";
let activeSearch = "";
let activeScriptId = null;
let activeMode = "script";
let qualityMode = false;

const scriptList = document.getElementById("scriptList");
const scriptDetail = document.getElementById("scriptDetail");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const countValue = document.getElementById("countValue");
const themeValue = document.getElementById("themeValue");
const statusValue = document.getElementById("statusValue");
const shootingValue = document.getElementById("shootingValue");
const searchValue = document.getElementById("searchValue");

const horsSeriePanel = document.getElementById("horsSeriePanel");
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

/* Hors-série : vidéos liées au calendrier, en complément de la ligne directrice.
   Un hors-série porte horsSerie: true et, si possible, une fenêtre de publication
   (publishFrom et publishUntil au format AAAA-MM-JJ). */

const horsSerieLeadDays = 30;
const horsSerieStateRank = { open: 0, soon: 1, undated: 2, later: 3, expired: 4 };

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysBetween(from, to) {
  return Math.round((to - from) / 86400000);
}

function formatDayMonth(date) {
  const day = date.getDate() === 1 ? "1er" : String(date.getDate());
  return `${day} ${date.toLocaleDateString("fr-FR", { month: "long" })}`;
}

function formatFullDate(date) {
  return `${formatDayMonth(date)} ${date.getFullYear()}`;
}

function formatWindow(script) {
  const from = parseIsoDate(script.publishFrom);
  const until = parseIsoDate(script.publishUntil);

  if (from && until) {
    const sameYear = from.getFullYear() === until.getFullYear();
    return `du ${sameYear ? formatDayMonth(from) : formatFullDate(from)} au ${formatFullDate(until)}`;
  }

  if (from) return `à partir du ${formatFullDate(from)}`;
  if (until) return `jusqu’au ${formatFullDate(until)}`;

  return "date à fixer";
}

function formatDayCount(days) {
  return `${days} jour${days > 1 ? "s" : ""}`;
}

function getHorsSerieState(script) {
  if (!script.horsSerie) return null;

  const today = getToday();
  const from = parseIsoDate(script.publishFrom);
  const until = parseIsoDate(script.publishUntil);

  // label : l'état ; detail : la phrase du bloc « du moment » ; short : la précision entre parenthèses.
  if (!from && !until) {
    return { key: "undated", label: "Date à fixer", detail: "fenêtre de publication à définir", short: "" };
  }

  if (until && today > until) {
    return { key: "expired", label: "Passé", detail: `fenêtre close le ${formatFullDate(until)}`, short: "close" };
  }

  if (!from || today >= from) {
    if (!until) {
      return { key: "open", label: "À publier maintenant", detail: "fenêtre ouverte", short: "ouverte" };
    }

    const left = daysBetween(today, until);
    const leftText = left === 0 ? "dernier jour" : `encore ${formatDayCount(left)}`;

    return { key: "open", label: "À publier maintenant", detail: `jusqu’au ${formatDayMonth(until)}, ${leftText}`, short: leftText };
  }

  const wait = daysBetween(today, from);
  const waitText = `dans ${formatDayCount(wait)}`;

  return {
    key: wait <= horsSerieLeadDays ? "soon" : "later",
    label: wait <= horsSerieLeadDays ? "À préparer" : "À venir",
    detail: `fenêtre ${waitText}`,
    short: waitText
  };
}

function isHorsSerieCurrent(script) {
  const state = getHorsSerieState(script);
  return Boolean(state) && (state.key === "open" || state.key === "soon");
}

function compareHorsSerie(a, b) {
  const stateA = getHorsSerieState(a);
  const stateB = getHorsSerieState(b);
  const rankDiff = horsSerieStateRank[stateA.key] - horsSerieStateRank[stateB.key];

  if (rankDiff !== 0) return rankDiff;

  const farFuture = new Date(9999, 0, 1);
  const fromA = parseIsoDate(a.publishFrom) || farFuture;
  const fromB = parseIsoDate(b.publishFrom) || farFuture;
  const untilA = parseIsoDate(a.publishUntil) || farFuture;
  const untilB = parseIsoDate(b.publishUntil) || farFuture;

  if (stateA.key === "open") return untilA - untilB;
  if (stateA.key === "expired") return untilB - untilA;

  return fromA - fromB;
}

function getHorsSerieScripts() {
  return scripts.filter((script) => script.horsSerie).sort(compareHorsSerie);
}

function getMainScripts() {
  return scripts.filter((script) => !script.horsSerie);
}

function hasBody(script) {
  return Array.isArray(script.body) && script.body.length > 0;
}

function getProductionStatus(script) {
  return script.productionStatus || script.status || "Non défini";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isReadyStatus(script) {
  const status = normalizeText(script.status);
  return status.includes("pret") || /\bvalide\b/.test(status);
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

  const matches = scripts.filter((script) => {
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
      getProductionStatus(script),
      script.natural,
      script.label,
      script.horsSerie ? `hors-série hors serie actualité ${formatWindow(script)} ${script.recurrence}` : "",
      script.duration,
      script.notes?.intention,
      script.notes?.rythme,
      script.notes?.vigilance,
      ...(script.body || [])
    ].join(" "));

    const searchOk = !query || searchableText.includes(query);

    let themeOk;

    if (activeTheme === "hors-serie") {
      themeOk = script.horsSerie;
    } else {
      const sameTheme = activeTheme === "all" || script.theme === activeTheme;
      // Hors du filtre « Hors-série », seuls les hors-série du moment remontent,
      // sauf pendant une recherche, qui parcourt toute la bibliothèque.
      const visible = !script.horsSerie || Boolean(query) || isHorsSerieCurrent(script);
      themeOk = sameTheme && visible;
    }

    return themeOk && statusOk && shootingOk && searchOk;
  });

  const horsSerie = matches.filter((script) => script.horsSerie).sort(compareHorsSerie);
  const main = matches.filter((script) => !script.horsSerie);

  return [...horsSerie, ...main];
}

function getThemeLabel() {
  const labels = {
    all: "Tous",
    investir: "Investir",
    fiscalite: "Fiscalité",
    epargne: "Épargne",
    "hors-serie": "Hors-série"
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

/* La synthèse compte la ligne directrice. Les hors-série ont leur propre bloc. */

function getStatusCounts() {
  let ready = 0;
  let toValidate = 0;

  getMainScripts().forEach((script) => {
    if (isReadyStatus(script)) ready += 1;
    if (isToValidateStatus(script)) toValidate += 1;
  });

  return { ready, toValidate };
}

function getShootingCounts() {
  const main = getMainScripts();
  const total = main.length;
  const shot = main.filter((script) => isScriptShot(script.id)).length;
  const notShot = total - shot;

  return { total, shot, notShot };
}

function getProductionCounts() {
  const counts = {
    writing: 0,
    validation: 0,
    validated: 0,
    toShoot: 0,
    shot: 0,
    edited: 0,
    published: 0,
    other: 0
  };

  getMainScripts().forEach((script) => {
    const status = normalizeText(getProductionStatus(script));

    if (status.includes("ecrire")) {
      counts.writing += 1;
    } else if (status.includes("valider")) {
      counts.validation += 1;
    } else if (status.includes("valide")) {
      counts.validated += 1;
    } else if (status.includes("tourner")) {
      counts.toShoot += 1;
    } else if (status.includes("tourne")) {
      counts.shot += 1;
    } else if (status.includes("monte")) {
      counts.edited += 1;
    } else if (status.includes("publie")) {
      counts.published += 1;
    } else {
      counts.other += 1;
    }
  });

  return counts;
}

function renderHorsSeriePanel() {
  if (!horsSeriePanel) return;

  const all = getHorsSerieScripts();

  if (!all.length) {
    horsSeriePanel.style.display = "none";
    horsSeriePanel.innerHTML = "";
    return;
  }

  horsSeriePanel.style.display = "block";

  const current = all.filter(isHorsSerieCurrent);
  const next = all.find((script) => {
    const state = getHorsSerieState(script);
    return state.key === "later";
  });

  const cards = current.map((script) => {
    const state = getHorsSerieState(script);
    const shot = isScriptShot(script.id);

    return `
      <button class="hs-card ${state.key}" onclick="openHorsSerie('${script.id}')">
        <span class="hs-state">${state.label} · ${state.detail}</span>
        <strong>${script.title}</strong>
        <small>${script.label} · À publier ${formatWindow(script)} · ${shot ? "Tourné" : script.status}</small>
      </button>
    `;
  }).join("");

  const emptyText = next
    ? `Aucun hors-série à préparer dans les ${horsSerieLeadDays} prochains jours. Prochain : « ${next.title} », à publier ${formatWindow(next)}.`
    : "Tous les hors-série du calendrier sont passés : il est à reconduire, avec de nouvelles dates, pour l’année qui vient.";

  horsSeriePanel.innerHTML = `
    <div class="summary-head">
      <div>
        <h3>Hors-série du moment</h3>
        <p>Des vidéos liées au calendrier, à tourner en complément de la ligne directrice. Elles ne décalent aucun numéro.</p>
      </div>
      <button class="hs-all-button ${activeTheme === "hors-serie" ? "active" : ""}" onclick="selectTheme('hors-serie')">
        Voir les ${all.length} hors-série de l’année
      </button>
    </div>

    ${current.length ? `<div class="hs-grid">${cards}</div>` : `<div class="hs-empty">${emptyText}</div>`}
  `;
}

/* Synthèse repliée par défaut ; le choix est retenu dans ce navigateur. */
const summaryOpenKey = "britedStudioV2SummaryOpen";
let summaryOpen = loadSummaryOpen();

function loadSummaryOpen() {
  try {
    return localStorage.getItem(summaryOpenKey) === "1";
  } catch (error) {
    return false;
  }
}

function toggleSummary() {
  summaryOpen = !summaryOpen;

  try {
    localStorage.setItem(summaryOpenKey, summaryOpen ? "1" : "0");
  } catch (error) {
    // Sans stockage, le choix vaut pour la visite en cours.
  }

  renderSummaryPanel();
}

function renderSummaryPanel() {
  renderHorsSeriePanel();

  const mainScripts = getMainScripts();
  const total = mainScripts.length;
  const investir = mainScripts.filter((script) => script.theme === "investir").length;
  const fiscalite = mainScripts.filter((script) => script.theme === "fiscalite").length;
  const epargne = mainScripts.filter((script) => script.theme === "epargne").length;
  const statusCounts = getStatusCounts();
  const shootingCounts = getShootingCounts();
  const productionCounts = getProductionCounts();

  summaryPanel.innerHTML = `
    <div class="summary-head">
      <div>
        <h3>Synthèse automatique</h3>
        <p>${summaryOpen
          ? "Vue globale de la ligne directrice, avec suivi local du tournage et statut de production. Les hors-série sont suivis dans le bloc ci-dessus."
          : `${total} scripts · ${statusCounts.toValidate} à valider · ${shootingCounts.shot} tourné${shootingCounts.shot > 1 ? "s" : ""} · ${shootingCounts.notShot} restant${shootingCounts.notShot > 1 ? "s" : ""}`}</p>
      </div>
      <button class="summary-toggle" onclick="toggleSummary()" aria-expanded="${summaryOpen}">
        ${summaryOpen ? "Masquer le détail" : "Afficher le détail"}
      </button>
    </div>

    <div class="summary-details ${summaryOpen ? "" : "hidden"}">
    <div class="summary-grid">
      <div class="summary-card">
        <span>Ligne directrice</span>
        <strong>${total}</strong>
        <small>Scripts numérotés, dans l’ordre</small>
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

    <div class="summary-grid" style="margin-top: 12px;">
      <div class="summary-card">
        <span>Prod. à écrire</span>
        <strong>${productionCounts.writing}</strong>
        <small>Scripts à rédiger</small>
      </div>

      <div class="summary-card gold">
        <span>Prod. à valider</span>
        <strong>${productionCounts.validation}</strong>
        <small>Scripts en validation</small>
      </div>

      <div class="summary-card">
        <span>Prod. validés</span>
        <strong>${productionCounts.validated}</strong>
        <small>Prêts pour la suite</small>
      </div>

      <div class="summary-card blue">
        <span>Prod. à tourner</span>
        <strong>${productionCounts.toShoot}</strong>
        <small>À passer en tournage</small>
      </div>

      <div class="summary-card blue">
        <span>Prod. tournés</span>
        <strong>${productionCounts.shot}</strong>
        <small>Enregistrés</small>
      </div>

      <div class="summary-card">
        <span>Prod. montés</span>
        <strong>${productionCounts.edited}</strong>
        <small>Montage terminé</small>
      </div>

      <div class="summary-card">
        <span>Prod. publiés</span>
        <strong>${productionCounts.published}</strong>
        <small>Mis en ligne</small>
      </div>

      <div class="summary-card">
        <span>Prod. autres</span>
        <strong>${productionCounts.other}</strong>
        <small>Statuts non classés</small>
      </div>
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
        <small>${script.label}${script.horsSerie ? ` · Hors-série, à publier ${formatWindow(script)}` : ""}</small>
      </div>

      <div class="quality-field">
        <span>Thème</span>
        <strong>${script.category}</strong>
      </div>

      <div class="quality-field">
        <span>Statut éditorial</span>
        <strong>${script.status}</strong>
      </div>

      <div class="quality-field">
        <span>Production</span>
        <strong>${getProductionStatus(script)}</strong>
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
        <p>Vue rapide des scripts visibles avec leurs informations de relecture, production et tournage.</p>
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
    // Par défaut, on ouvre le premier script de la ligne directrice, pas un hors-série épinglé.
    activeScriptId = (items.find((script) => !script.horsSerie) || items[0]).id;
  }

  const horsSerieGroupLabels = {
    open: "Hors-série · à publier maintenant",
    soon: "Hors-série · à préparer",
    undated: "Hors-série · date à fixer",
    later: "Hors-série · à venir",
    expired: "Hors-série · passés"
  };

  const hasHorsSerie = items.some((script) => script.horsSerie);
  let lastGroup = null;

  scriptList.innerHTML = items.map((script) => {
    const shot = isScriptShot(script.id);
    const state = getHorsSerieState(script);

    // Un intertitre à chaque changement de groupe : les hors-série d'abord,
    // classés par échéance, puis la ligne directrice dans l'ordre des numéros.
    let group = "";
    let groupLabel = "";

    if (script.horsSerie) {
      group = activeTheme === "hors-serie" ? state.key : "current";
      groupLabel = activeTheme === "hors-serie" ? horsSerieGroupLabels[state.key] : "Hors-série du moment";
    } else if (hasHorsSerie) {
      group = "main";
      groupLabel = "Ligne directrice";
    }

    const separator = group && group !== lastGroup
      ? `<div class="list-group-label ${script.horsSerie ? "gold" : ""}">${groupLabel}</div>`
      : "";

    lastGroup = group;

    const classes = [
      "list-card",
      script.id === activeScriptId ? "active" : "",
      shot ? "shot" : "",
      script.horsSerie ? "hors-serie" : "",
      state && state.key === "expired" ? "expired" : ""
    ].filter(Boolean).join(" ");

    return `
      ${separator}
      <button class="${classes}" onclick="selectScript('${script.id}')">
        <div class="list-meta">
          <span class="list-time ${script.horsSerie ? "gold" : ""}">${script.label}</span>
          <span class="list-status">${script.status}</span>
          <span class="shot-badge">${getProductionStatus(script)}</span>
          ${shot ? `<span class="shot-badge">Tourné</span>` : ""}
        </div>
        ${state ? `<div class="list-window ${state.key}"><strong>${state.label}</strong> · fenêtre ${formatWindow(script)}</div>` : ""}
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
  const state = getHorsSerieState(script);
  const written = hasBody(script);

  const bodyHtml = written
    ? script.body.map((paragraph) => `<p>${paragraph}</p>`).join("")
    : `<p class="empty-script">Ce script n’est pas encore écrit. L’angle prévu, les points à vérifier et les sources à consulter sont dans les notes de tournage.</p>`;

  const windowHtml = state
    ? `
    <div class="window-box ${state.key}">
      <strong>Hors-série · ${state.label}</strong><br>
      Fenêtre de publication : ${formatWindow(script)}${state.short ? ` (${state.short})` : ""}.<br>
      ${script.recurrence ? `Retour du sujet : ${script.recurrence}.<br>` : ""}
      Cette vidéo s’ajoute à la ligne directrice, sans en changer l’ordre.
    </div>`
    : "";

  scriptDetail.innerHTML = `
    <div class="script-top">
      <div class="badges">
        <span class="badge time">${script.label}</span>
        ${script.horsSerie ? `<span class="badge hors-serie">Hors-série</span>` : ""}
        <span class="badge status">${script.status}</span>
        <span class="badge natural">${script.natural}</span>
        <span class="badge shot">Production : ${getProductionStatus(script)}</span>
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

    ${windowHtml}

    <div class="meta-box">
      <strong>${script.category}</strong><br>
      <strong>Pour :</strong> ${script.target}<br>
      <strong>Statut éditorial :</strong> ${script.status}<br>
      <strong>Statut de production :</strong> ${getProductionStatus(script)}<br>
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
        ${script.horsSerie ? "Sujet daté : vérifiez aussi, le jour du tournage, que les règles et les chiffres cités sont toujours en vigueur." : ""}
      </div>
    </div>
  `;
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

function selectTheme(theme) {
  activeTheme = theme;
  activeMode = "script";

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.theme === theme);
  });

  renderList();
}

function openHorsSerie(id) {
  activeScriptId = id;
  activeMode = "script";

  // Si les filtres en cours cachent ce hors-série, on bascule sur son filtre.
  if (!filteredScripts().some((script) => script.id === id)) {
    activeStatus = "all";
    activeShootingFilter = "all";
    activeSearch = "";
    searchInput.value = "";
    selectTheme("hors-serie");
    activeScriptId = id;
  }

  renderList();
  scriptDetail.scrollIntoView({ behavior: "smooth", block: "start" });
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

  if (!hasBody(script)) {
    showToast("Ce script n’est pas encore écrit");
    return;
  }

  shootingTitle.textContent = script.title;
  shootingMeta.textContent = `${script.label} · ${script.category} · ${script.duration} · Production : ${getProductionStatus(script)}`;
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

  renderList();
}

function formatScriptForCopy(script) {
  const shotLabel = isScriptShot(script.id) ? "Tourné" : "Non tourné";

  return [
    script.horsSerie ? `${script.label} · ${script.title}` : `${script.number}. ${script.title}`,
    `${script.category}`,
    ...(script.horsSerie ? [`Hors-série, à publier ${formatWindow(script)}`] : []),
    `Statut éditorial : ${script.status}`,
    `Statut de production : ${getProductionStatus(script)}`,
    `Tournage : ${shotLabel}`,
    "",
    hasBody(script) ? script.body.join("\n\n") : "(Script pas encore écrit)",
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
    `Thème : ${getThemeLabel()}`,
    `Statut éditorial : ${getStatusLabel()}`,
    `Tournage : ${getShootingLabel()}`,
    `Recherche : ${activeSearch.trim() ? activeSearch.trim() : "Aucune"}`,
    `Nombre : ${items.length} script${items.length > 1 ? "s" : ""}`,
    "========================================"
  ].join("\n");

  const body = items.map((script) => formatScriptForCopy(script)).join("\n\n");

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

  if (!hasBody(script)) {
    showToast("Ce script n’est pas encore écrit");
    return;
  }

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

  const themePart = createSafeFilename(getThemeLabel());
  const statusPart = createSafeFilename(getStatusLabel());
  const shootingPart = createSafeFilename(getShootingLabel());
  const searchPart = activeSearch.trim()
    ? `-${createSafeFilename(activeSearch.trim())}`
    : "";

  const filename = `brited-studio-scripts-${themePart}-${statusPart}-${shootingPart}${searchPart}.txt`;

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

  const themePart = createSafeFilename(getThemeLabel());
  const statusPart = createSafeFilename(getStatusLabel());
  const typePart = type === "shot" ? "tournes" : "non-tournes";
  const searchPart = activeSearch.trim()
    ? `-${createSafeFilename(activeSearch.trim())}`
    : "";

  const filename = `brited-studio-${typePart}-${themePart}-${statusPart}${searchPart}.txt`;

  downloadTextFile(exportData.text, filename, exportData.items.length);
}

function scrollToScripts() {
  document.getElementById("scripts").scrollIntoView({ behavior: "smooth" });
}

function isHorsSerieValue(value) {
  return value === true || ["true", "oui", "1"].includes(normalizeText(value));
}

function normalizeScript(script) {
  return {
    number: 0,
    label: "",
    horsSerie: isHorsSerieValue(script.horsSerie),
    publishFrom: script.publishFrom || "",
    publishUntil: script.publishUntil || "",
    recurrence: script.recurrence || "",
    id: script.id || "",
    theme: script.theme || "",
    category: script.category || "",
    status: script.status || "Non défini",
    productionStatus: script.productionStatus || script.status || "Non défini",
    natural: script.natural || "Naturel",
    duration: script.duration || "Durée non définie",
    title: script.title || "Titre non renseigné",
    summary: script.summary || "",
    target: script.target || "",
    conclusion: script.conclusion || "",
    body: Array.isArray(script.body) ? script.body : [],
    notes: {
      intention: script.notes?.intention || "Non renseignée",
      rythme: script.notes?.rythme || "Non renseigné",
      vigilance: script.notes?.vigilance || "Non renseignée"
    },
    sources: script.sources || "Non renseigné",
    guide: script.guide || "Non renseigné"
  };
}

searchInput.addEventListener("input", () => {
  activeSearch = searchInput.value;
  activeMode = "script";
  renderList();
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    selectTheme(chip.dataset.theme);
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

    const response = await fetch(`data/scripts.json?v=${Date.now()}`);

    if (!response.ok) {
      throw new Error("Impossible de charger data/scripts.json");
    }

    const loadedScripts = await response.json();

    if (!Array.isArray(loadedScripts) || !loadedScripts.length) {
      throw new Error("Le fichier scripts.json est vide ou invalide");
    }

    // Deux numérotations séparées : la ligne directrice garde ses numéros (N° 1, N° 2…)
    // quel que soit le nombre de hors-série (HS 1, HS 2…) ajoutés au fichier.
    let mainNumber = 0;
    let horsSerieNumber = 0;

    scripts = loadedScripts.map((rawScript) => {
      const script = normalizeScript(rawScript);

      if (script.horsSerie) {
        horsSerieNumber += 1;
        script.number = horsSerieNumber;
        script.label = `HS ${horsSerieNumber}`;
      } else {
        mainNumber += 1;
        script.number = mainNumber;
        script.label = `N° ${mainNumber}`;
      }

      return script;
    });

    // La ligne directrice reste le point d'entrée : on ouvre sur son premier script.
    activeScriptId = (getMainScripts()[0] || scripts[0]).id;

    // Lien direct vers le calendrier des hors-série : index.html#hors-serie
    if (window.location.hash === "#hors-serie" && scripts.some((script) => script.horsSerie)) {
      selectTheme("hors-serie");
    } else {
      renderList();
    }
  } catch (error) {
    console.error("Erreur de chargement des scripts :", error);

    scriptList.innerHTML = "";
    summaryPanel.innerHTML = "";
    if (horsSeriePanel) horsSeriePanel.innerHTML = "";
    emptyState.style.display = "block";
    emptyState.textContent = "Impossible de charger les scripts. Vérifiez data/scripts.json ou la console du navigateur.";
    scriptDetail.style.display = "none";
    updateControlPanel(0);
  }
}

loadScripts();
