const form = document.getElementById("scriptForm");
const jsonOutput = document.getElementById("jsonOutput");
const previewCard = document.getElementById("previewCard");

function splitParagraphs(value) {
  return String(value || "")
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFormValue(name) {
  return form.elements[name].value.trim();
}

function buildScriptObject() {
  return {
    id: getFormValue("id"),
    day: getFormValue("day"),
    weekday: getFormValue("weekday"),
    time: getFormValue("time"),
    theme: getFormValue("theme"),
    category: getFormValue("category"),
    status: getFormValue("status"),
    productionStatus: getFormValue("productionStatus"),
    natural: getFormValue("natural"),
    duration: getFormValue("duration"),
    title: getFormValue("title"),
    summary: getFormValue("summary"),
    target: getFormValue("target"),
    conclusion: getFormValue("conclusion"),
    body: splitParagraphs(getFormValue("body")),
    notes: {
      intention: getFormValue("intention"),
      rythme: getFormValue("rythme"),
      vigilance: getFormValue("vigilance")
    },
    sources: getFormValue("sources"),
    guide: getFormValue("guide")
  };
}

function generateJson() {
  const scriptObject = buildScriptObject();
  jsonOutput.value = JSON.stringify(scriptObject, null, 2);

  previewCard.innerHTML = `
    <strong>Aperçu</strong>
    <h3>${scriptObject.title || "Titre non renseigné"}</h3>
    <p>${scriptObject.day} ${scriptObject.weekday} · ${scriptObject.time} · ${scriptObject.category}</p>
    <p><strong>Production :</strong> ${scriptObject.productionStatus}</p>
  `;

  showToast("JSON généré");
}

function copyJson() {
  if (!jsonOutput.value.trim()) {
    showToast("Aucun JSON à copier");
    return;
  }

  navigator.clipboard.writeText(jsonOutput.value).then(() => {
    showToast("JSON copié");
  });
}

function resetForm() {
  form.reset();

  jsonOutput.value = `{
  "id": "",
  "day": "",
  "weekday": "",
  "time": "",
  "theme": "",
  "category": "",
  "status": "",
  "productionStatus": "",
  "natural": "",
  "duration": "",
  "title": "",
  "summary": "",
  "target": "",
  "conclusion": "",
  "body": [],
  "notes": {
    "intention": "",
    "rythme": "",
    "vigilance": ""
  },
  "sources": "",
  "guide": ""
}`;

  previewCard.innerHTML = `
    <strong>Aperçu</strong>
    <h3>Aucun script généré</h3>
    <p>Remplis le formulaire puis clique sur “Générer le JSON”.</p>
  `;

  showToast("Formulaire réinitialisé");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateJson();
});
