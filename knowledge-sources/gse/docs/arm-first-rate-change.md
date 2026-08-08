# ARM first rate change date

## Definitions

- **First rate change date** — First date the ARM note interest rate can adjust. Not the first borrower payment after closing, and not the MBS pool issue date.
- **First payment change date** — First due date of the new principal-and-interest payment after a rate adjustment.

## Usual note math

On typical agency ARMs, rate and payment do not move on the same day:

**1st interest rate change date ≈ 1st payment change date − 1 month**

Examples:

- Rate change **March 1** → payment change **April 1**
- Rate change **June 1** → payment change **July 1**

Fannie loan-delivery job aids often calculate the interest rate change date as the 1st payment change date minus one month. Initial fixed period (e.g. 60 months on a 5/1) is commonly measured from first payment date to first interest rate change date.

ARM Flex MBS pools generally require payment due dates on the first of the month; odd due dates need a negotiated contract.

## Bank / ops cycle cutoff (example)

Some lenders use a calendar cutoff so lookback, rate calculation, Reg Z notices, and boarding still fit before the next payment-change cycle.

Example training pattern:

| Cutoff date | Allowed cycle |
|---|---|
| **March 10** or earlier | **April** OK (rate in March → new payment April 1) |
| **March 11** or later | Miss April → roll to **July** (rate in June → new payment July 1) |

The 10th/11th only chooses which cycle the bank books. Inside that cycle, note math (rate month, then payment month) still applies. Cutoffs are investor/servicer-specific — not universal agency guide text.

## Notices (Reg Z)

When a rate adjustment changes the payment, servicers must send disclosures timed from the **first payment at the adjusted level**:

- Initial adjustment: typically 210–240 days before that payment (or at consummation if sooner).
- Subsequent adjustments: typically 60–120 days before (shorter windows for very frequent adjusters).

Index lookback is plan-specific (often on the order of ~45 days before the rate change).

## Verify

Confirm the note, ARM plan, investor matrix, and servicer calendar before locking first rate / payment change dates.