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
const statusSelect = document.getElementById("statusSelect");
const shootingSelect = document.getElementById("shootingSelect");

const countValue = document.getElementById("countValue");
const resetButton = document.getElementById("resetButton");

const progressPanel = document.getElementById("progressPanel");
const horsSeriePanel = document.getElementById("horsSeriePanel");
const qualityPanel = document.getElementById("qualityPanel");
const qualityButton = document.getElementById("qualityButton");
const layout = document.getElementById("layout");
const exportMenu = document.getElementById("exportMenu");

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

/* Affichage */

const themeNames = {
  investir: "Investir",
  fiscalite: "Fiscalité",
  epargne: "Épargne"
};

/* Espaces insécables à l'affichage, pour ne jamais couper « 5 % », « 66 000 euros » ou « 1 min 30 ». */
function nb(text) {
  return String(text || "")
    .replace(/(\d) (?=\d{3}\b)/g, "$1 ")
    .replace(/(\d) (?=%|€|euros?\b|ans?\b|mois\b|min\b|s\b|jours?\b|fois\b)/g, "$1 ")
    .replace(/ (?=[:;!?»])/g, " ")
    .replace(/« /g, "« ")
    .replace(/(N°|HS) (?=\d)/g, "$1 ");
}

function plural(count, singular, pluralForm) {
  return `${count} ${count > 1 ? (pluralForm || `${singular}s`) : singular}`;
}

/* Détail de la production, replié par défaut ; le choix est retenu dans ce navigateur. */
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

  renderProgress();
}

function renderProgress() {
  const shooting = getShootingCounts();
  const status = getStatusCounts();
  const production = getProductionCounts();
  const percent = shooting.total ? Math.round((shooting.shot / shooting.total) * 100) : 0;

  const rows = [
    ["À écrire", production.writing],
    ["À valider", production.validation],
    ["Validés", production.validated],
    ["À tourner", production.toShoot],
    ["Tournés (production)", production.shot],
    ["Montés", production.edited],
    ["Publiés", production.published],
    ["Autres statuts", production.other]
  ];

  progressPanel.innerHTML = `
    <div class="progress-line">
      <span><strong>${shooting.shot} / ${shooting.total}</strong> tournés</span>
      <span>${status.toValidate} à valider</span>
    </div>
    <div class="progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></div>
    <button class="link-button" onclick="toggleSummary()" aria-expanded="${summaryOpen}">
      ${summaryOpen ? "Masquer le détail" : "Détail de la production"}
    </button>
    ${summaryOpen ? `
      <div class="progress-detail">
        ${rows.map(([label, value]) => `<span>${label}</span><span>${value}</span>`).join("")}
      </div>` : ""}
  `;
}

function renderHorsSeriePanel() {
  const all = getHorsSerieScripts();

  if (!all.length) {
    horsSeriePanel.hidden = true;
    horsSeriePanel.innerHTML = "";
    return;
  }

  horsSeriePanel.hidden = false;

  const current = all.filter(isHorsSerieCurrent);
  const next = all.find((script) => getHorsSerieState(script).key === "later");

  const items = current.map((script) => {
    const state = getHorsSerieState(script);

    return `
      <li>
        <button class="hs-item" onclick="openHorsSerie('${script.id}')">
          <span class="hs-tag">${script.label}</span>
          <span class="hs-name">${script.title}</span>
          <span class="hs-when">${state.label} · ${state.detail}</span>
        </button>
      </li>
    `;
  }).join("");

  const emptyText = next
    ? `Rien à préparer dans les ${horsSerieLeadDays} prochains jours. Prochain : « ${next.title} », à publier ${formatWindow(next)}.`
    : "Tous les hors-série du calendrier sont passés : il est à reconduire, avec de nouvelles dates, pour l’année qui vient.";

  horsSeriePanel.innerHTML = nb(`
    <div class="hs-head">
      <span class="hs-title">Hors-série du moment</span>
      <button class="link-button" onclick="selectTheme('hors-serie')">Calendrier des ${all.length} hors-série</button>
    </div>
    ${current.length ? `<ul class="hs-items">${items}</ul>` : `<p class="hs-empty">${emptyText}</p>`}
  `);
}

function hasActiveFilters() {
  return activeTheme !== "all"
    || activeStatus !== "all"
    || activeShootingFilter !== "all"
    || Boolean(activeSearch.trim())
    || qualityMode;
}

function updateToolbar(count) {
  countValue.textContent = `${plural(count, "script")} affiché${count > 1 ? "s" : ""}`;
  resetButton.hidden = !hasActiveFilters();

  document.querySelectorAll(".seg").forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === activeTheme);
  });

  statusSelect.value = activeStatus;
  shootingSelect.value = activeShootingFilter;
  qualityButton.textContent = qualityMode ? "Revenir à la lecture" : "Vue contrôle qualité";
}

function renderQualityPanel(items) {
  qualityPanel.hidden = !qualityMode;
  layout.hidden = qualityMode;

  if (!qualityMode) {
    qualityPanel.innerHTML = "";
    return;
  }

  const rows = items.map((script) => `
    <tr>
      <td class="num">${script.label}</td>
      <td>${script.title}<br><span class="row-meta">${script.category}</span></td>
      <td>${script.status}</td>
      <td>${getProductionStatus(script)}</td>
      <td>${isScriptShot(script.id) ? "Tourné" : "Non tourné"}</td>
      <td class="note">
        <strong>Intention.</strong> ${script.notes.intention}<br>
        <strong>Rythme.</strong> ${script.notes.rythme}<br>
        <strong>Vigilance.</strong> ${script.notes.vigilance}
      </td>
    </tr>
  `).join("");

  qualityPanel.innerHTML = `
    <div class="quality-head">
      <strong>Contrôle qualité · ${plural(items.length, "script")}</strong>
      <button class="link-button" onclick="toggleQualityMode()">Revenir à la lecture</button>
    </div>
    ${items.length ? `
      <table>
        <thead>
          <tr><th>N°</th><th>Titre</th><th>Statut</th><th>Production</th><th>Tournage</th><th>Notes</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>` : `<p class="empty" style="display: block;">Aucun script ne correspond aux filtres actuels.</p>`}
  `;
}

function renderList() {
  const items = filteredScripts();

  renderProgress();
  renderHorsSeriePanel();
  updateToolbar(items.length);
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

  const groupLabels = {
    open: "Hors-série · à publier maintenant",
    soon: "Hors-série · à préparer",
    undated: "Hors-série · date à fixer",
    later: "Hors-série · à venir",
    expired: "Hors-série · passés"
  };

  const hasHorsSerie = items.some((script) => script.horsSerie);
  let lastGroup = null;

  scriptList.innerHTML = nb(items.map((script) => {
    const shot = isScriptShot(script.id);
    const state = getHorsSerieState(script);

    // Un intertitre à chaque changement de groupe : les hors-série d'abord,
    // classés par échéance, puis la ligne directrice dans l'ordre des numéros.
    let group = "";
    let groupLabel = "";

    if (script.horsSerie) {
      group = activeTheme === "hors-serie" ? state.key : "current";
      groupLabel = activeTheme === "hors-serie" ? groupLabels[state.key] : "Hors-série du moment";
    } else if (hasHorsSerie) {
      group = "main";
      groupLabel = "Ligne directrice";
    }

    const separator = group && group !== lastGroup
      ? `<div class="group-label ${script.horsSerie ? "hs" : ""}">${groupLabel}</div>`
      : "";

    lastGroup = group;

    const classes = [
      "row",
      script.id === activeScriptId ? "active" : "",
      script.horsSerie ? "hs" : "",
      state && state.key === "expired" ? "expired" : ""
    ].filter(Boolean).join(" ");

    const meta = script.horsSerie
      ? `${state.label} · ${formatWindow(script)}`
      : `${themeNames[script.theme] || script.category} · ${script.status}`;

    return `
      ${separator}
      <button class="${classes}" onclick="selectScript('${script.id}')">
        <span class="row-num">${script.horsSerie ? script.label : script.number}</span>
        <span>
          <span class="row-title">${script.title}</span>
          <span class="row-meta">${meta}${shot ? ` · <span class="shot-mark">✓ Tourné</span>` : ""}</span>
        </span>
      </button>
    `;
  }).join(""));

  renderDetail();
}

function renderDetail() {
  const script = scripts.find((item) => item.id === activeScriptId);
  if (!script) return;

  const shot = isScriptShot(script.id);
  const state = getHorsSerieState(script);
  const written = hasBody(script);

  const windowHtml = state
    ? `
      <div class="window-note ${state.key}">
        <strong>${state.label}.</strong>
        Fenêtre de publication ${formatWindow(script)}${state.short ? ` (${state.short})` : ""}.
        ${script.recurrence ? `Le sujet revient ${script.recurrence}.` : ""}
      </div>`
    : "";

  const facts = [
    ["Pour", script.target],
    ["Phrase finale", script.conclusion],
    ["Durée", script.duration],
    ["Statut", `${script.status}${getProductionStatus(script) !== script.status ? ` · production : ${getProductionStatus(script)}` : ""}`],
    ["Style oral", script.natural]
  ].filter(([, value]) => value);

  let panel;

  if (activeMode === "notes") {
    panel = `
      <dl class="facts">
        ${facts.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("")}
      </dl>
      <dl class="notes-list">
        <div><dt>Intention</dt><dd>${script.notes.intention}</dd></div>
        <div><dt>Rythme</dt><dd>${script.notes.rythme}</dd></div>
        <div><dt>Vigilance</dt><dd>${script.notes.vigilance}</dd></div>
      </dl>`;
  } else if (activeMode === "sources") {
    panel = `
      <dl class="notes-list">
        <div><dt>Sources et précisions</dt><dd>${script.sources}</dd></div>
        <div><dt>Guide de tournage</dt><dd>${script.guide}</dd></div>
      </dl>`;
  } else {
    panel = `
      <div class="script-text" id="currentScriptBody">
        ${written
          ? script.body.map((paragraph) => `<p>${paragraph}</p>`).join("")
          : `<p class="not-written">Ce script n’est pas encore écrit. L’angle prévu et les points à vérifier sont dans les notes de tournage.</p>`}
      </div>`;
  }

  const tab = (mode, label) => `<button class="tab ${activeMode === mode ? "active" : ""}" onclick="setMode('${mode}')">${label}</button>`;

  scriptDetail.innerHTML = nb(`
    <div class="detail-meta">
      ${script.horsSerie ? `<span class="hs-label">${script.label} · Hors-série</span>` : script.label}
      · ${script.category}${shot ? ` · <span class="shot-mark">✓ Tourné</span>` : ""}
    </div>
    <h2 class="detail-title">${script.title}</h2>

    ${windowHtml}

    <div class="detail-actions">
      <button class="button primary" onclick="openShootingMode()" ${written ? "" : "disabled"}>Mode tournage</button>
      <button class="button" onclick="copyCurrentScript()">Copier le texte</button>
      <button class="button ${shot ? "done" : ""}" onclick="toggleCurrentScriptShot()">
        ${shot ? "✓ Tourné" : "Marquer comme tourné"}
      </button>
    </div>

    <div class="tabs" role="tablist">
      ${tab("script", "Texte")}
      ${tab("notes", "Notes de tournage")}
      ${tab("sources", "Sources et guide")}
    </div>

    <div class="tab-panel">${panel}</div>

    <p class="detail-warning">
      Texte à valider avant tournage : vérifiez le fond, les chiffres et l’adéquation avec votre pratique professionnelle.
      ${script.horsSerie ? "Sujet daté : vérifiez aussi, le jour du tournage, que les règles et les chiffres cités sont toujours en vigueur." : ""}
    </p>
  `);
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
  renderList();
}

function openHorsSerie(id) {
  activeScriptId = id;
  activeMode = "script";
  qualityMode = false;

  // Si les filtres en cours cachent ce hors-série, on bascule sur son filtre.
  if (!filteredScripts().some((script) => script.id === id)) {
    activeStatus = "all";
    activeShootingFilter = "all";
    activeSearch = "";
    searchInput.value = "";
    activeTheme = "hors-serie";
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
}

function closeMenu() {
  exportMenu.open = false;
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

  shootingTitle.textContent = nb(`${script.label} · ${script.title}`);
  shootingMeta.textContent = nb(`${script.duration} · Taille du texte : A− et A+ (touches − et +) · Échap pour quitter`);
  shootingBody.innerHTML = nb(script.body.map((paragraph) => `<p>${paragraph}</p>`).join(""));

  updateShootingShotButton();

  shootingOverlay.classList.add("active");
  shootingOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  shootingBody.scrollTop = 0;
  applyShootingSize();
}

/* Taille du texte du prompteur. Par défaut, « Tout à l'écran » : la plus grande taille
   qui fait tenir le script entier sans défiler. A− et A+ fixent une taille, retenue
   dans ce navigateur. */
const promptSizeKey = "britedStudioV2PromptSize";
const promptSizeMin = 16;
const promptSizeMax = 72;
let promptSize = loadPromptSize();

function loadPromptSize() {
  try {
    const saved = localStorage.getItem(promptSizeKey);
    const size = Number(saved);
    return saved && saved !== "fit" && size >= promptSizeMin && size <= promptSizeMax ? size : "fit";
  } catch (error) {
    return "fit";
  }
}

function savePromptSize() {
  try {
    localStorage.setItem(promptSizeKey, String(promptSize));
  } catch (error) {
    // Sans stockage, la taille vaut pour la visite en cours.
  }
}

function applyShootingSize() {
  if (promptSize === "fit") {
    fitShootingText(false);
  } else {
    shootingBody.style.fontSize = `${promptSize}px`;
  }

  document.getElementById("shootingFitButton").classList.toggle("active", promptSize === "fit");
}

function fitShootingText(remember) {
  if (remember) {
    promptSize = "fit";
    savePromptSize();
    document.getElementById("shootingFitButton").classList.add("active");
  }

  const available = shootingBody.clientHeight;
  let low = promptSizeMin;
  let high = promptSizeMax;

  // Recherche par dichotomie de la plus grande taille qui tient sans défiler.
  while (high - low > 0.5) {
    const middle = (low + high) / 2;
    shootingBody.style.fontSize = `${middle}px`;

    if (shootingBody.scrollHeight <= available) {
      low = middle;
    } else {
      high = middle;
    }
  }

  shootingBody.style.fontSize = `${Math.floor(low)}px`;
}

function changeShootingSize(delta) {
  const current = parseFloat(getComputedStyle(shootingBody).fontSize) || 24;
  promptSize = Math.max(promptSizeMin, Math.min(promptSizeMax, Math.round(current + delta)));
  savePromptSize();
  applyShootingSize();
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
  closeMenu();
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

document.querySelectorAll(".seg").forEach((button) => {
  button.addEventListener("click", () => {
    selectTheme(button.dataset.theme);
  });
});

statusSelect.addEventListener("change", () => selectStatusFilter(statusSelect.value));
shootingSelect.addEventListener("change", () => selectShootingFilter(shootingSelect.value));

document.addEventListener("click", (event) => {
  if (exportMenu.open && !exportMenu.contains(event.target)) closeMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (shootingOverlay.classList.contains("active")) {
    closeShootingMode();
  } else {
    closeMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (!shootingOverlay.classList.contains("active")) return;
  if (event.key === "+" || event.key === "=") changeShootingSize(2);
  if (event.key === "-" || event.key === "−") changeShootingSize(-2);
});

window.addEventListener("resize", () => {
  if (shootingOverlay.classList.contains("active") && promptSize === "fit") fitShootingText(false);
});

async function loadScripts() {
  try {
    emptyState.style.display = "block";
    emptyState.textContent = "Chargement des scripts…";

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
      activeTheme = "hors-serie";
    }

    renderList();
  } catch (error) {
    console.error("Erreur de chargement des scripts :", error);

    scriptList.innerHTML = "";
    progressPanel.innerHTML = "";
    horsSeriePanel.hidden = true;
    emptyState.style.display = "block";
    emptyState.textContent = "Impossible de charger les scripts. Vérifiez data/scripts.json ou la console du navigateur.";
    scriptDetail.style.display = "none";
    countValue.textContent = "0 script";
  }
}

loadScripts();
