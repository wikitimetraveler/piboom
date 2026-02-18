# ICE Developer Connect Docs

This folder holds **saved snapshots** of Encompass Developer Connect documentation (HTML, Markdown, or PDF). These are ingested by the ICE knowledge build and made available to the Encompass Assistant.

## Purpose

- Developer Connect web pages can change or disappear; snapshots preserve content for the assistant.
- Add pages that are not covered by the cloned ICE repos or Postman collections.
- Keep critical reference material local and versioned.

## How to Add Content

1. Save a Developer Connect page as HTML (Save As → Web Page, Complete) or convert to Markdown.
2. Place the file in this directory: `knowledge-sources/ice/docs/`
3. Use descriptive names: e.g. `oauth-flow.html`, `loan-api-basics.md`
4. Run the normalizer:
   ```bash
   npm run build:ice-knowledge
   ```
5. Commit the updated `data/knowledge/ice-sources.json` if desired.

## Naming Conventions

- Use lowercase with hyphens: `custom-forms-guide.html`
- Include the topic in the filename for traceability
- Avoid special characters or spaces

## What Gets Indexed

The build script (`scripts/build-ice-knowledge.js`) scans this folder and includes matching files in `ice-sources.json`. The Encompass Assistant then retrieves these during RAG search.

## Related

- **docs/ICE_KNOWLEDGE_SOURCES.md** – Full source inventory and refresh workflow
- **docs/ENCOMPASS.md** – Encompass integration overview
