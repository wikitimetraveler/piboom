# EAD / UAD 3.6 sample fixtures

Place GSE **Appendix D-1** nested appraisal ZIPs in `appendix-d-1/`. Those files are **not** committed (see `.gitignore`).

## Fetch

1. Download  
   https://sf.freddiemac.com/docs/zip/requirements/appendix-d-1-urar-sample-scenarios-and-xml-files.zip
2. Unzip the outer archive.
3. Copy every `*_Appraisal.zip` into `fixtures/ead/appendix-d-1/`.

The `/ead/` page dropdown lists those packages. Prefer **SF5** for a typical single-family report.

Override the folder with env `EAD_SAMPLES_DIR` if needed.

See `docs/EAD.md`.
