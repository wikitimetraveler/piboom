# Agency product fit (decision support)

## Scope

DevConnect Labs GSE scenario analyzer is **decision-support only**. It uses bundled public-rule summaries and sample FHFA limits — not DU/LPA/TOTAL/GUS, not pricing, not approval, not Ginnie pool eligibility.

## Agencies

- **Fannie Mae** — Conventional conforming; Selling Guide; products such as HomeReady.
- **Freddie Mac** — Conventional conforming; Seller/Servicer Guide; products such as Home Possible.
- **FHA** — HUD Handbook 4000.1; government-insured; may support Ginnie Mae MBS after issuer pooling.
- **VA** — VA Pamphlet 26-7; guaranteed; may support Ginnie Mae MBS after issuer pooling.
- **USDA** — HB-1-3555; rural guaranteed; may support Ginnie Mae MBS after issuer pooling.
- **Ginnie Mae** — MBS guarantor for government loans; not an underwriting agency.

## Overlays

Lender/investor overlays can tighten agency minimums (credit, LTV, reserves, property type). Overlay findings are operational risk signals — always confirm current investor matrices.

## FHFA loan limits

Conforming loan limits vary by county and unit count. High-cost areas may have higher ceilings. Bundled limit JSON is a sample year snapshot — verify fhfa.gov for production.

## Expert modes

Useful questions for the loan-program expert:

- Compare affordable options (HomeReady vs Home Possible)
- Overlay blockers and ops next steps
- Required docs upfront
- Pooling / MBS delivery path after program fit
- ARM first rate vs payment change timing
