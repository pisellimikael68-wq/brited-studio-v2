const importInput = document.getElementById("importInput");
const importOutput = document.getElementById("importOutput");
const importErrors = document.getElementById("importErrors");
const importPreview = document.getElementById("importPreview");

const statBlocks = document.getElementById("statBlocks");
const statScripts = document.getElementById("statScripts");
const statErrors = document.getElementById("statErrors");

const requiredFields = [
  "id",
  "day",
  "weekday",
  "time",
  "theme",
  "category",
  "status",
  "productionStatus",
  "title",
  "summary",
  "target",
  "conclusion"
];

const defaultTemplate = `---
id: script-029
day: 16
weekday: Mer
time: 09:00
theme: investir
category: Investir · Allocation
status: À valider
productionStatus: À écrire
natural: Naturel
duration: Objectif 60–65 secondes
title: Pourquoi diversifier ses placements ?
summary: Script court sur la diversification.
target: Épargnants qui concentrent tout sur un seul support.
conclusion: Diversifier, ce n’est pas compliquer. C’est répartir le risque.

Texte:
Premier paragraphe du script.

Deuxième paragraphe du script.

Troisième paragraphe du script.

Notes:
Intention: Expliquer l’intérêt de diversifier.
Rythme: Posé, pédagogique.
Vigilance: Ne pas promettre de performance.

Sources: À compléter.
Guide: Ton simple, exemple concret.
---

---
id: script-030
day: 16
weekday: Mer
time: 09:30
theme: fiscalite
category: Fiscalité · Déclaration
status: À valider
productionStatus: À écrire
natural: Naturel
duration: Objectif 60–65 secondes
title: Pourquoi relire sa déclaration avant de valider ?
summary: Script court sur l’intérêt de vérifier les informations fiscales.
target: Contribuables qui valident trop vite leur déclaration.
conclusion: Une déclaration relue, c’est souvent une erreur évitée.

Texte:
Premier paragraphe du script.

Deuxième paragraphe du script.

Troisième paragraphe du script.

Notes:
Intention: Encourager une vérification simple avant validation.
Rythme: Clair, rassurant, concret.
Vigilance: Ne pas donner de conseil fiscal personnalisé.

Sources: À compléter.
Guide: Ton pédagogique, exemple du quotidien.
---`;

function setDefaultTemplate() {
  importInput.value = defaultTemplate;
  showToast("Modèle chargé");
}

function clearImport() {
  importInput.value = "";
  importOutput.value = "";
  importPreview.innerHTML = "";
  showErrors([]);
  updateStats(0, 0, 0);
  showToast("Import réinitialisé");
}

function splitBlocks(rawText) {
  return String(rawText || "")
    .split(/^---\s*$/gm)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseKeyValueLine(line) {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();

  if (!key) {
    return null;
  }

  return { key, value };
}

function parseNotesSection(lines) {
  const notes = {
    intention: "",
    rythme: "",
    vigilance: ""
  };

  lines.forEach((line) => {
    const parsed = parseKeyValueLine(line);

    if (!parsed) return;

    const key = normalizeKey(parsed.key);

    if (key === "intention") {
      notes.intention = parsed.value;
    }

    if (key === "rythme") {
      notes.rythme = parsed.value;
    }

    if (key === "vigilance") {
      notes.vigilance = parsed.value;
    }
  });

  return notes;
}

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function normalizeFieldName(key) {
  const normalized = normalizeKey(key);

  const map = {
    id: "id",
    day: "day",
    jour: "day",
    weekday: "weekday",
    joursemaine: "weekday",
    time: "time",
    horaire: "time",
    theme: "theme",
    themetechnique: "theme",
    category: "category",
    categorie: "category",
    categorieaffichee: "category",
    status: "status",
    statut: "status",
    statuteditorial: "status",
    productionstatus: "productionStatus",
    statutproduction: "productionStatus",
    statutdeproduction: "productionStatus",
    natural: "natural",
    styleoral: "natural",
    duration: "duration",
    duree: "duration",
    dureeestimee: "duration",
    title: "title",
    titre: "title",
    summary: "summary",
    resume: "summary",
    resumecourt: "summary",
    target: "target",
    cible: "target",
    pourqui: "target",
    conclusion: "conclusion",
    sources: "sources",
    source: "sources",
    guide: "guide",
    guidedetournage: "guide"
  };

  return map[normalized] || key.trim();
}

function parseScriptBlock(block, index) {
  const lines = block.split("\n");
  const data = {};
  const bodyLines = [];
  const noteLines = [];

  let section = "meta";

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      if (section === "body") {
        bodyLines.push("");
      }

      return;
    }

    const normalizedLine = normalizeKey(line.replace(":", ""));

    if (normalizedLine === "texte") {
      section = "body";
      return;
    }

    if (normalizedLine === "notes") {
      section = "notes";
      return;
    }

    if (section === "body") {
      bodyLines.push(rawLine);
      return;
    }

    if (section === "notes") {
      const parsed = parseKeyValueLine(line);

      if (parsed) {
        const field = normalizeFieldName(parsed.key);

        if (field === "sources" || field === "guide") {
          data[field] = parsed.value;
          return;
        }
      }

      noteLines.push(line);
      return;
    }

    const parsed = parseKeyValueLine(line);

    if (parsed) {
      const field = normalizeFieldName(parsed.key);
      data[field] = parsed.value;
    }
  });

  const script = {
    id: data.id || "",
    day: data.day || "",
    weekday: data.weekday || "",
    time: data.time || "",
    theme: data.theme || "",
    category: data.category || "",
    status: data.status || "",
    productionStatus: data.productionStatus || "",
    natural: data.natural || "Naturel",
    duration: data.duration || "Objectif 60–65 secondes",
    title: data.title || "",
    summary: data.summary || "",
    target: data.target || "",
    conclusion: data.conclusion || "",
    body: buildParagraphs(bodyLines),
    notes: parseNotesSection(noteLines),
    sources: data.sources || "À compléter.",
    guide: data.guide || "À compléter."
  };

  return {
    index,
    script,
    errors: validateScript(script, index)
  };
}

function buildParagraphs(lines) {
  return lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function validateScript(script, index) {
  const errors = [];
  const label = script.id || `bloc ${index + 1}`;

  requiredFields.forEach((field) => {
    if (!script[field]) {
      errors.push(`${label} : champ manquant “${field}”.`);
    }
  });

  if (!Array.isArray(script.body) || script.body.length === 0) {
    errors.push(`${label} : le texte du script est vide.`);
  }

  if (!script.notes.intention) {
    errors.push(`${label} : note manquante “Intention”.`);
  }

  if (!script.notes.rythme) {
    errors.push(`${label} : note manquante “Rythme”.`);
  }

  if (!script.notes.vigilance) {
    errors.push(`${label} : note manquante “Vigilance”.`);
  }

  return errors;
}

function findDuplicateIds(parsedBlocks) {
  const seen = new Set();
  const duplicates = [];

  parsedBlocks.forEach((item) => {
    const id = item.script.id;

    if (!id) return;

    if (seen.has(id)) {
      duplicates.push(id);
    }

    seen.add(id);
  });

  return duplicates;
}

function generateImportJson() {
  const blocks = splitBlocks(importInput.value);
  const parsedBlocks = blocks.map((block, index) => parseScriptBlock(block, index));
  const duplicateIds = findDuplicateIds(parsedBlocks);

  let errors = parsedBlocks.flatMap((item) => item.errors);

  duplicateIds.forEach((id) => {
    errors.push(`Identifiant en double dans l’import : ${id}.`);
  });

  const validScripts = parsedBlocks
    .filter((item) => item.errors.length === 0)
    .map((item) => item.script);

  updateStats(blocks.length, validScripts.length, errors.length);
  showErrors(errors);
  renderPreview(validScripts);

  if (!validScripts.length) {
    importOutput.value = "";
    showToast("Aucun script valide");
    return;
  }

  importOutput.value = JSON.stringify(validScripts, null, 2);

  if (errors.length) {
    showToast("JSON généré avec alertes");
  } else {
    showToast("JSON généré");
  }
}

function copyImportJson() {
  if (!importOutput.value.trim()) {
    showToast("Aucun JSON à copier");
    return;
  }

  navigator.clipboard.writeText(importOutput.value).then(() => {
    showToast("JSON copié");
  });
}

function downloadImportJson() {
  if (!importOutput.value.trim()) {
    showToast("Aucun JSON à télécharger");
    return;
  }

  const blob = new Blob([importOutput.value], {
    type: "application/json;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "brited-import-scripts.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  showToast("Fichier JSON téléchargé");
}

function updateStats(blockCount, scriptCount, errorCount) {
  statBlocks.textContent = blockCount;
  statScripts.textContent = scriptCount;
  statErrors.textContent = errorCount;
}

function showErrors(errors) {
  if (!errors.length) {
    importErrors.classList.remove("active");
    importErrors.innerHTML = "";
    return;
  }

  importErrors.classList.add("active");
  importErrors.innerHTML = `
    <strong>Points à corriger</strong>
    <ul>
      ${errors.map((error) => `<li>${error}</li>`).join("")}
    </ul>
  `;
}

function renderPreview(scripts) {
  if (!scripts.length) {
    importPreview.innerHTML = "";
    return;
  }

  importPreview.innerHTML = scripts.slice(0, 8).map((script) => `
    <div class="import-preview-item">
      <strong>${script.id} · ${script.productionStatus}</strong>
      <h3>${script.title}</h3>
      <p>${script.day} ${script.weekday} · ${script.time} · ${script.category}</p>
    </div>
  `).join("");

  if (scripts.length > 8) {
    importPreview.innerHTML += `
      <div class="import-preview-item">
        <strong>+ ${scripts.length - 8} autres scripts</strong>
        <p>Le JSON complet contient tous les scripts valides.</p>
      </div>
    `;
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

updateStats(0, 0, 0);
