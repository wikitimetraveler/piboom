# ICE Knowledge Sources

Central tracker for every Encompass / ICE Mortgage Technology artifact we ingest into the assistant. All sources are **read only**—execution remains disabled until we explicitly flip the feature flag.

## Folder Layout

```
knowledge-sources/
  ice/
    repos/                # Git clones of ICE public repositories (one folder per repo)
    postman/              # Exported *.postman_collection.json + environments
    docs/                 # Saved HTML/Markdown/PDF snapshots from Developer Connect
data/
  knowledge/
    ice-sources.json      # Generated index used by the assistant (auto-created)
```

Create the folders if they do not exist and drop the artifacts inside. Keep the repo copies lean (remove `.git`, `node_modules`, and build outputs) so the normalizer can scan them quickly.

## Source Inventory

| Type | Name | Upstream URL | Local Target |
| --- | --- | --- | --- |
| Repo | imt-developerconnect-dotnet-bindings | https://github.com/intercontinentalexchange/imt-developerconnect-dotnet-bindings | `knowledge-sources/ice/repos/imt-developerconnect-dotnet-bindings` |
| Repo | imt-integration-dotnetcore-sample-application | https://github.com/intercontinentalexchange/imt-integration-dotnetcore-sample-application | `knowledge-sources/ice/repos/imt-integration-dotnetcore-sample-application` |
| Repo | imt-loconnect-custom-tool-sample | https://github.com/intercontinentalexchange/imt-loconnect-custom-tool-sample | `knowledge-sources/ice/repos/imt-loconnect-custom-tool-sample` |
| Repo | imt-exp20-token-exchange | https://github.com/intercontinentalexchange/imt-exp20-token-exchange | `knowledge-sources/ice/repos/imt-exp20-token-exchange` |
| Repo | imt-exp20-ifb-scripting | https://github.com/intercontinentalexchange/imt-exp20-ifb-scripting | `knowledge-sources/ice/repos/imt-exp20-ifb-scripting` |
| Repo | imt-epc-datadocs-mockinvestor | https://github.com/intercontinentalexchange/imt-epc-datadocs-mockinvestor | `knowledge-sources/ice/repos/imt-epc-datadocs-mockinvestor` |
| Repo | exp24-custom-form | https://github.com/intercontinentalexchange/exp24-custom-form | `knowledge-sources/ice/repos/exp24-custom-form` |
| Repo | nyse-bqt-cloudstreaming | https://github.com/intercontinentalexchange/nyse-bqt-cloudstreaming | `knowledge-sources/ice/repos/nyse-bqt-cloudstreaming` |
| Postman | Encompass Developer Connect Collection | https://developer.icemortgagetechnology.com/developer-connect/docs/postman-collection | `knowledge-sources/ice/postman/*.postman_collection.json` |
| Postman | Encompass 3-Environment Collection | https://developer.icemortgagetechnology.com/developer-connect/docs/postman-environments | `knowledge-sources/ice/postman/*.postman_environment.json` |
| Docs | Dev Connect HTML/PDF snapshots | https://developer.icemortgagetechnology.com/developer-connect/docs | `knowledge-sources/ice/docs/*.html` or `*.md` |

Add more entries as needed. The normalizer only cares that a file exists inside the appropriate directory.

## Refresh Workflow

1. `git clone` or update each repo into its folder (remove `.git` afterwards if you do not want nested repos).
2. Export the latest Postman collection(s) and environments to JSON and drop them into `knowledge-sources/ice/postman`.
3. Save any new Developer Connect pages as HTML or Markdown inside `knowledge-sources/ice/docs`.
4. Run the normalizer:  
   ```bash
   node scripts/build-ice-knowledge.js
   ```
5. Commit the updated `data/knowledge/ice-sources.json`.

> Tip: Schedule the refresh quarterly or whenever ICE publishes notable changes. Track the date in the `lastVerified` field (auto-populated by the script).

## Assistant Integration

The generated index powers `lib/knowledge/ice-knowledge.service.js`, which the Encompass assistant uses during retrieval. Every record includes:

- `sourceType` (e.g., `code_reference`, `api_reference`, `official_doc`)
- `repo` / `path` for traceability
- `executionAllowed=false` flag so the assistant never tries to run live calls

As long as you keep `ice-sources.json` current, the assistant will cite both the official Dev Connect docs and the ICE sample repos/Postman examples in responses.

**Note:** The Code Clairvoyant (`tool9.html`) is a separate form-code review assistant that analyzes manifest XML directly; it does not use the ICE knowledge index.

## Related Documentation

- **Encompass integration overview**: [`ENCOMPASS.md`](ENCOMPASS.md)
- **AI system architecture**: [`AI_SYSTEM.md`](AI_SYSTEM.md)
- **System self-knowledge for AI agents**: [`AGENTS.md`](../AGENTS.md)

