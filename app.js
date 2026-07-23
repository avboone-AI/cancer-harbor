const menuButton = document.querySelector(".menu-button");
const mobileNav = document.querySelector("#mobileNav");
const profileForm = document.querySelector("#profileForm");
const saveProfileButton = document.querySelector("#saveProfile");
const trialSearchForm = document.querySelector("#trialSearchForm");
const trialResults = document.querySelector("#trialResults");
const trialStatus = document.querySelector("#trialStatus");
const alertForm = document.querySelector("#alertForm");
const alertMessage = document.querySelector("#alertMessage");

const profileStorageKey = "cancerHarborProfile";

menuButton?.addEventListener("click", () => {
  const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isExpanded));
  mobileNav.hidden = isExpanded;
});

mobileNav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    mobileNav.hidden = true;
    menuButton?.setAttribute("aria-expanded", "false");
  }
});

function restoreProfile() {
  const savedProfile = localStorage.getItem(profileStorageKey);
  if (!savedProfile || !profileForm) return;

  try {
    const profile = JSON.parse(savedProfile);
    for (const [key, value] of Object.entries(profile)) {
      const field = profileForm.elements.namedItem(key);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.value = value;
      }
    }
  } catch {
    localStorage.removeItem(profileStorageKey);
  }
}

saveProfileButton?.addEventListener("click", () => {
  if (!profileForm) return;

  const data = new FormData(profileForm);
  const profile = {
    cancerType: data.get("cancerType")?.toString() ?? "",
    biomarkers: data.get("biomarkers")?.toString() ?? "",
    priorTreatments: data.get("priorTreatments")?.toString() ?? "",
    location: data.get("location")?.toString() ?? "",
    radius: data.get("radius")?.toString() ?? "50",
  };

  localStorage.setItem(profileStorageKey, JSON.stringify(profile));
  saveProfileButton.textContent = "Saved in this browser";
  window.setTimeout(() => {
    saveProfileButton.textContent = "Save browser profile";
  }, 1800);
});

function getProfileSummary() {
  const fallback = {
    cancerType: document.querySelector("#conditionInput")?.value ?? "",
    biomarkers: "",
    priorTreatments: "",
    location: document.querySelector("#locationInput")?.value ?? "",
  };

  try {
    return JSON.parse(localStorage.getItem(profileStorageKey)) ?? fallback;
  } catch {
    return fallback;
  }
}

function createClinicalTrialsUrl({ condition, keyword, location }) {
  const params = new URLSearchParams();
  params.set("format", "json");
  params.set("pageSize", "10");
  params.set("query.cond", condition);
  params.set("filter.overallStatus", "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING");

  if (keyword) params.set("query.term", keyword);
  if (location) params.set("query.locn", location);

  return `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`;
}

function getNestedStudyValue(study, path, fallback = "Not listed") {
  return path.reduce((value, key) => value?.[key], study) ?? fallback;
}

function summarizeLocations(study) {
  const contactsLocations = getNestedStudyValue(study, ["protocolSection", "contactsLocationsModule"], {});
  const locations = contactsLocations.locations ?? [];

  if (!locations.length) return "Locations not listed";

  return locations
    .slice(0, 3)
    .map((location) => [location.facility, location.city, location.state, location.country].filter(Boolean).join(", "))
    .filter(Boolean)
    .join(" | ");
}

function buildEmailHref(study) {
  const profile = getProfileSummary();
  const nctId = getNestedStudyValue(study, ["protocolSection", "identificationModule", "nctId"], "");
  const title = getNestedStudyValue(study, ["protocolSection", "identificationModule", "briefTitle"], "Clinical trial");
  const subject = encodeURIComponent(`Question about trial ${nctId}`);
  const body = encodeURIComponent(
    `Hello,\n\nI am reaching out to ask whether this patient may be appropriate for screening for ${title} (${nctId}).\n\nCancer type: ${profile.cancerType || "Not provided"}\nBiomarkers/mutations: ${profile.biomarkers || "Not provided"}\nPrior treatments: ${profile.priorTreatments || "Not provided"}\nLocation/travel radius: ${profile.location || "Not provided"}\n\nCould you please let us know the best next step, key eligibility criteria to confirm, and whether you are currently accepting inquiries?\n\nThank you.`
  );

  return `mailto:?subject=${subject}&body=${body}`;
}

function renderTrialCard(study) {
  const protocol = study.protocolSection ?? {};
  const id = protocol.identificationModule?.nctId ?? "NCT unavailable";
  const title = protocol.identificationModule?.briefTitle ?? "Untitled study";
  const status = protocol.statusModule?.overallStatus?.replaceAll("_", " ") ?? "Status not listed";
  const phase = protocol.designModule?.phases?.join(", ") ?? "Phase not listed";
  const summary = protocol.descriptionModule?.briefSummary ?? "No summary provided.";
  const conditions = protocol.conditionsModule?.conditions ?? [];
  const url = `https://clinicaltrials.gov/study/${id}`;

  const card = document.createElement("article");
  card.className = "trial-card";
  card.innerHTML = `
    <header>
      <div>
        <h3>${escapeHtml(title)}</h3>
        <span>${escapeHtml(id)}</span>
      </div>
      <span class="pill">${escapeHtml(status)}</span>
    </header>
    <div class="pill-row">
      <span class="pill">${escapeHtml(phase)}</span>
      ${conditions.slice(0, 4).map((condition) => `<span class="pill">${escapeHtml(condition)}</span>`).join("")}
    </div>
    <p>${escapeHtml(summary.slice(0, 420))}${summary.length > 420 ? "..." : ""}</p>
    <p><strong>Locations:</strong> ${escapeHtml(summarizeLocations(study))}</p>
    <div class="trial-actions">
      <a href="${url}" target="_blank" rel="noreferrer">View trial</a>
      <a href="${buildEmailHref(study)}">Draft inquiry email</a>
    </div>
  `;

  return card;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

trialSearchForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const condition = document.querySelector("#conditionInput").value.trim();
  const keyword = document.querySelector("#keywordInput").value.trim();
  const location = document.querySelector("#locationInput").value.trim();

  if (!condition) return;

  trialStatus.textContent = "Searching ClinicalTrials.gov...";
  trialResults.replaceChildren();

  try {
    const response = await fetch(createClinicalTrialsUrl({ condition, keyword, location }));
    if (!response.ok) throw new Error(`ClinicalTrials.gov returned ${response.status}`);

    const data = await response.json();
    const studies = data.studies ?? [];
    trialStatus.textContent = `${studies.length} study result${studies.length === 1 ? "" : "s"} shown. Check eligibility details with the trial team.`;

    if (!studies.length) {
      trialResults.innerHTML = `<article class="trial-card"><h3>No studies found</h3><p>Try a broader cancer type, remove the location, or search directly on ClinicalTrials.gov and the NCI trial search.</p></article>`;
      return;
    }

    trialResults.replaceChildren(...studies.map(renderTrialCard));
  } catch (error) {
    trialStatus.textContent = "Live search could not complete.";
    trialResults.innerHTML = `
      <article class="trial-card">
        <h3>Search unavailable</h3>
        <p>${escapeHtml(error.message)}. You can still search directly at ClinicalTrials.gov or wire this template to a backend proxy.</p>
      </article>
    `;
  }
});

alertForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(alertForm);
  const email = data.get("email");
  const focus = data.get("focus") || "this cancer profile";
  alertMessage.textContent = `Prototype alert created for ${email}: research news and trial monitoring for ${focus}. Connect this form to a secure backend email service before launch.`;
  alertForm.reset();
});

restoreProfile();
