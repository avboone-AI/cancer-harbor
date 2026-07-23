# The Cancer Harbor Project

A static website template for an educational cancer navigation resource. The template includes:

- Plain-language "Cancer. Now what?" guidance
- Self-advocacy prompts and records checklist
- First-line progression decision flow
- Browser-only patient profile prototype
- ClinicalTrials.gov live search prototype
- Trial inquiry email draft links
- Email alert subscription prototype
- Multi-patient browser-local health tracker
- PDF, image OCR, pasted-text, and Excel intake with a verification step
- Treatment, lesion, RECIST, biomarker, lab, symptom, note, and source-document tracking
- Excel and CSV export

## Run Locally

On a Mac, double-click `Open Cancer Harbor.command`. It starts the private local server if needed and opens the site in the default browser.

Do not open `index.html` directly: browser security restrictions on `file://` pages prevent parts of the health tracker from loading.

To start the server manually instead:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

The health tracker is available at `http://localhost:8080/tracker/`. Sharon Boone's June 2026 dataset is included as the seeded patient, and additional patients can be created from the patient selector. Each patient record is stored separately in that browser.

## Collaborating With Git

Use one shared GitHub repository as the source of truth. Each person should clone the repo into their own Codex workspace, then work on a separate branch for each change.

Suggested workflow:

```bash
git pull
git checkout -b codex/short-feature-name
# make changes with Codex
git add .
git commit -m "Describe the change"
git push -u origin codex/short-feature-name
```

Open a pull request on GitHub when the branch is ready to review. After it is merged, both collaborators should run `git pull` before starting the next change.

To reduce merge conflicts, avoid editing the same section of the same file at the same time. A simple split is one person working on app behavior in `app.js` or `tracker-app/src/`, while the other works on content, copy, or styles.

## Important Product Notes

This template is educational and not medical advice. A production version that stores patient profiles, uploads medical documents, or sends alerts based on personal health information should be designed for HIPAA-aware handling, including:

- explicit consent and authorization flows
- encrypted storage and transport
- least-privilege account access
- audit logging
- data retention and deletion controls
- signed business associate agreements with eligible vendors when required
- clinician/legal review of medical wording and disclaimers

## Trial Search Integrations

The current front-end searches ClinicalTrials.gov API v2:

```text
https://clinicaltrials.gov/api/v2/studies
```

Useful next sources for an aggregator:

- ClinicalTrials.gov data API: https://clinicaltrials.gov/data-api
- NCI Clinical Trials Search API: https://www.cancer.gov/syndication/api
- NCI trial search: https://www.cancer.gov/research/participate/clinical-trials-search

For production, use a backend search service instead of relying only on browser calls. A backend can normalize results, cache responses, score relevance, de-duplicate trials, enrich location distance, and run scheduled searches for email alerts.

## MyChart / Medical Records

The template does not connect directly to MyChart. Direct EHR access usually requires patient authorization, health-system integration, and privacy/security review. Early versions can guide users to export documents or use sharing tools:

- MyChart sharing overview: https://www.mychart.org/Sharing-Your-Medical-Record
- Epic Share Everywhere FAQ: https://shareeverywhere.epic.com/FAQ

## Suggested Backend Roadmap

1. Add secure accounts and consent screens.
2. Add encrypted document upload and OCR/PDF extraction.
3. Convert uploaded records into a structured cancer profile.
4. Add ClinicalTrials.gov plus NCI API aggregation.
5. Add trial fit explanations with eligibility caveats.
6. Add saved searches and scheduled email alerts.
7. Add admin review tools for content, sources, and safety language.
