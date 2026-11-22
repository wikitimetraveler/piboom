import { formatDate, formatMoney } from '../areas';
import type { ChannelId, ImpactResult, ImpactedLoan } from '../types';

const CHANNEL_LABELS: Record<ChannelId, string> = {
  delegated: 'Correspondent Delegated',
  non_delegated: 'Correspondent Non-Delegated',
  consumer: 'Consumer Direct',
  unassigned: 'Channel not recorded',
};
const BOOK_LABELS = { pipeline: 'Pipeline', inventory: 'Inventory', servicing: 'Servicing Portfolio' };
const MATCH_LABELS = { zip: 'ZIP Code', fips: 'County FIPS', name: 'County name' };
const ROWS_SHOWN = 200;

type Props = {
  impact: ImpactResult | null;
  loading: boolean;
  error: string;
  /** Review-step preview: nothing is declared yet, so no loan is on hold. */
  preview?: boolean;
  /** Used for the CSV file name. */
  eventName: string;
  onRefresh?: () => void;
};

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function holdText(loan: ImpactedLoan): string {
  const holds = [];
  if (loan.treasuryHold) holds.push('Treasury Hold');
  if (loan.fundingSuspension) holds.push('Funding suspended');
  return holds.join(' · ');
}

function downloadCsv(impact: ImpactResult, eventName: string) {
  const header = [
    'Loan number', 'Borrower', 'Property address', 'City', 'State', 'County', 'ZIP Code',
    'Matched area', 'Matched by', 'Book', 'Channel', 'Milestone', 'Loan amount',
    'Treasury Hold', 'Funding suspension', 'Incident period ended',
  ];
  const rows = impact.loans.map((l) => [
    l.loanNumber, l.borrowerName, l.propertyAddress, l.city, l.state, l.county, l.zipCode,
    l.matchedArea, MATCH_LABELS[l.matchMethod], BOOK_LABELS[l.loanBook], CHANNEL_LABELS[l.channel],
    l.milestone, l.loanAmount, l.treasuryHold ? 'Yes' : 'No', l.fundingSuspension ? 'Yes' : 'No',
    l.incidentEndDate || '',
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const slug = eventName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `impacted-loans-${slug || 'disaster'}-${impact.report.generatedAt.slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** BRD report: Pipeline by Channel by Milestone, Inventory, Servicing Portfolio. */
export default function ImpactReport({ impact, loading, error, preview, eventName, onRefresh }: Props) {
  const report = impact?.report;

  return (
    <div className="dp-report" aria-busy={loading}>
      <div className="dp-report-head">
        <div>
          <h3 className="dp-h3 mb-0">Impacted loans</h3>
          <p className="dp-muted mb-0">
            {report && !error
              ? `As of ${new Date(report.generatedAt).toLocaleString()}`
              : 'Pipeline by channel, Inventory and Servicing Portfolio'}
          </p>
        </div>
        <div className="dp-report-actions">
          {onRefresh && (
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={loading} onClick={onRefresh}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            disabled={!impact || !impact.count || Boolean(error)}
            onClick={() => impact && downloadCsv(impact, eventName)}
          >
            Download CSV
          </button>
        </div>
      </div>

      {error ? (
        <p className="dp-report-error" role="alert">
          The impacted-loan report did not load: {error}
        </p>
      ) : !impact || !report ? (
        <p className="dp-muted mb-0">{loading ? 'Matching loans to these areas…' : 'No report yet.'}</p>
      ) : impact.mode === 'memory' ? (
        <p className="dp-muted mb-0">
          No loan database is connected, so loans cannot be matched to these areas.
        </p>
      ) : (
        <>
          <dl className="dp-stats">
            <div>
              <dt>Impacted loans</dt>
              <dd>{report.totals.count.toLocaleString()}</dd>
              <span>{formatMoney(report.totals.amount)}</span>
            </div>
            <div>
              <dt>Pipeline</dt>
              <dd>{report.pipeline.count.toLocaleString()}</dd>
              <span>{formatMoney(report.pipeline.amount)}</span>
            </div>
            <div>
              <dt>Inventory</dt>
              <dd>{report.inventory.count.toLocaleString()}</dd>
              <span>{formatMoney(report.inventory.amount)}</span>
            </div>
            <div>
              <dt>Servicing Portfolio</dt>
              <dd>{report.servicing.count.toLocaleString()}</dd>
              <span>{formatMoney(report.servicing.amount)}</span>
            </div>
            {!preview && (
              <div>
                <dt>On Treasury Hold</dt>
                <dd>{report.totals.treasuryHold.toLocaleString()}</dd>
                <span>
                  {report.totals.fundingSuspension.toLocaleString()} funding suspended
                </span>
              </div>
            )}
          </dl>

          {report.totals.count === 0 ? (
            <p className="dp-muted mb-0">No loans on file have a property in these areas.</p>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table dp-table dp-matrix align-middle mb-0">
                  <caption>Pipeline by channel and milestone (loan count)</caption>
                  <thead>
                    <tr>
                      <th scope="col">Channel</th>
                      {report.pipeline.milestones.map((m) => (
                        <th scope="col" key={m} className="text-end">
                          {m}
                        </th>
                      ))}
                      <th scope="col" className="text-end">
                        Total
                      </th>
                      <th scope="col" className="text-end">
                        Loan amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.pipeline.channels.map((c) => (
                      <tr key={c.id} className={c.count ? undefined : 'is-empty'}>
                        <th scope="row">{c.label}</th>
                        {report.pipeline.milestones.map((m) => (
                          <td key={m} className="text-end">
                            {c.byMilestone[m]?.count.toLocaleString() ?? '—'}
                          </td>
                        ))}
                        <td className="text-end fw-semibold">{c.count.toLocaleString()}</td>
                        <td className="text-end">{formatMoney(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {impact.loanColumns && (!impact.loanColumns.channel || !impact.loanColumns.loanBook) && (
                <ul className="dp-report-notes">
                  {!impact.loanColumns.channel && (
                    <li>
                      Loan records carry no channel, so all {report.channelNotRecorded.toLocaleString()} pipeline
                      loans sit under “Channel not recorded”.
                    </li>
                  )}
                  {!impact.loanColumns.loanBook && (
                    <li>
                      Loan records are not marked Inventory or Servicing, so every matched loan is counted as
                      Pipeline.
                    </li>
                  )}
                </ul>
              )}

              <details className="dp-details mt-3">
                <summary>Loan list ({impact.count.toLocaleString()})</summary>
                <div className="table-responsive mt-2">
                  <table className="table dp-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Loan</th>
                        <th scope="col">Property</th>
                        <th scope="col">Matched area</th>
                        <th scope="col">Channel</th>
                        <th scope="col">Milestone</th>
                        <th scope="col" className="text-end">
                          Amount
                        </th>
                        {!preview && <th scope="col">Hold</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {impact.loans.slice(0, ROWS_SHOWN).map((l) => (
                        <tr key={l.id}>
                          <td>{l.loanNumber}</td>
                          <td>
                            {l.propertyAddress}
                            <div className="dp-muted">
                              {l.city}, {l.state} {l.zipCode}
                            </div>
                          </td>
                          <td>
                            {l.matchedArea || `${l.county}, ${l.state}`}
                            <div className="dp-muted">by {MATCH_LABELS[l.matchMethod]}</div>
                          </td>
                          <td>{CHANNEL_LABELS[l.channel]}</td>
                          <td>{l.milestone}</td>
                          <td className="text-end">{formatMoney(l.loanAmount)}</td>
                          {!preview && (
                            <td>
                              {holdText(l) ||
                                (l.incidentEndDate ? `Released ${formatDate(l.incidentEndDate)}` : '—')}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {impact.loans.length > ROWS_SHOWN && (
                  <p className="dp-muted mt-2 mb-0">
                    Showing the first {ROWS_SHOWN} loans. The CSV has{' '}
                    {impact.truncated
                      ? `the first ${impact.loans.length.toLocaleString()} of ${impact.count.toLocaleString()}`
                      : `all ${impact.count.toLocaleString()}`}
                    .
                  </p>
                )}
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
