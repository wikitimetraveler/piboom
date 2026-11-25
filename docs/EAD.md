# FHA EAD 3.6 appraisal packages

DevConnect Labs can ingest a UAD 3.6 appraisal ZIP the way the FHA Electronic Appraisal Delivery (EAD) portal expects it: one MISMO 3.6 XML, one URAR PDF, and an images folder. The `/ead/` app parses and validates locally. It does not submit to HUD’s EAD portal.

## Package shape (HUD)

From the [EAD Portal FAQs for UAD 3.6](https://www.hud.gov/sites/default/files/SFH/documents/sfh_EAD_Portal_FAQs_for_UAD_3.6_v1.pdf) and the [FHA EAD 3.6 General User Guide](https://www.hud.gov/sites/default/files/SFH/documents/sfh_FHA_EAD_3.6_General_User_Guide_v1.pdf):

| Rule | Detail |
|------|--------|
| Container | One `.zip`, max **60 MB** |
| XML | Exactly one MISMO® 3.6 (UAD 3.6) `.xml` |
| PDF | Exactly one URAR appraisal report `.pdf` (images embedded in the PDF) |
| Images | Folder of unique `.jpg` / `.png` files referenced from the XML |
| Document types | `AppraisalReport`, `ValuationUpdate`, or `ValuationCompletion` |

System findings mirrored in the parser (from the [ESR User Guide](https://www.hud.gov/sites/default/files/SFH/documents/sfh_ead_FHA_EAD_Submission_Results(ESR)_User_Guide_v1.pdf)):

| Code | Meaning |
|------|---------|
| SYS9001 | Appraisal data in invalid format / XML not well formed |
| SYS9003 | Missing Appraisal Report PDF |
| SYS9004 | Mismatched PDF file name vs XML reference |
| SYS9006 | More than one Appraisal Report PDF |
| SYS9008 | Missing appraisal image named in the XML |
| SYS9009 | Unreferenced appraisal image in the ZIP |

HUD’s [Implementation Preparedness Toolbox](https://www.hud.gov/sites/dfiles/SFH/documents/sfh_ead_FHA_UAD-3.6_Implementation_Preparedness_Toolbox_v1.pdf) points to the GSE UAD pages for sample scenarios. HUD does not host the sample XML, PDFs, or photos.

## GSE downloads (do not commit)

Linked from the [Freddie Mac UAD page](https://sf.freddiemac.com/tools-learning/uniform-mortgage-data-program/uad) (Fannie Mae hosts the same materials):

| Artifact | URL | Notes |
|----------|-----|--------|
| UAD 3.6 subschema | https://sf.freddiemac.com/docs/zip/uad-3.6-schema.zip | Unzip → `Combined/GSE_UAD_3.6.0_V1.3.xsd` (subschema v1.3). Schema only — no photos/PDF. |
| Appendix D-1 samples | https://sf.freddiemac.com/docs/zip/requirements/appendix-d-1-urar-sample-scenarios-and-xml-files.zip | ~62 MB. Twelve nested ZIPs (`SF*_Appraisal`, condo, co-op, manufactured, 2–4 unit). Each nested ZIP is one delivery package: XML + PDF + `Images/`. Prefer **SF5** for a straightforward single-family. |
| Appendix A-1 delivery spec | https://sf.freddiemac.com/docs/xls/requirements/appendix-a-1-urar-delivery-specification.xlsx | xPath / dataset mapping |
| Combined sample PDFs | https://sf.freddiemac.com/docs/pdf/uad-sample-scenarios-combined.pdf | PDFs only |

Current GSE samples are often labeled v1.2–v1.4 and validate against subschema v1.3. `MISMOReferenceModelIdentifier` on samples is typically `3.6.0366`.

**Do not commit** GSE ZIPs, XSDs, or sample packages into this repo. Unit tests use a synthetic in-memory ZIP.

## App & API

| Surface | Path |
|---------|------|
| UI | `/ead/` → `public/ead/index.html` |
| Parse | `POST /api/ead/parse` — multipart field `file` (`.zip`, ≤ 60 MB) |
| Samples | `GET /api/ead/samples` · `POST /api/ead/samples/:id/parse` — local Appendix D-1 scenarios |
| Assets | `GET /api/ead/assets/:sessionId/:name` — short-lived PDF/image from the last parse |
| Service | `services/ead-appraisal.service.js` |

Uploads stay in OS temp under a session id. Real appraisal packages can contain borrower PII — nothing is written under `data/`.

## Local scenario dropdown

1. Download Appendix D-1 from the Freddie Mac URL above.
2. Unzip the outer archive.
3. Copy every nested `*_Appraisal.zip` into `fixtures/ead/appendix-d-1/` (gitignored; see `fixtures/ead/README.md`).
4. Open `/ead/`, pick a scenario from the dropdown (default **SF5**), click **Load scenario**.

Optional: set `EAD_SAMPLES_DIR` to another folder of nested ZIPs.

## Manual check

1. Load **SF5** from the dropdown (or drop `Appendix D-1 SF5_Appraisal.zip`).
2. Confirm summary fields, photo strip, PDF preview, and an empty (or warning-only) validation list.
