import { useState } from 'react';
import {
  executeAllScenarios,
  parseLoanSnapshotJson,
  parseWorkbookJson,
  type LoanSnapshot,
  type ScenarioResult,
  type UnitTestWorkbook,
} from '@encompass-unit-tests/core';

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

function statusClass(passed: boolean, skipped: boolean): string {
  if (skipped) return '';
  return passed ? 'pass' : 'fail';
}

export default function App() {
  const [workbook, setWorkbook] = useState<UnitTestWorkbook | null>(null);
  const [snapshot, setSnapshot] = useState<LoanSnapshot | null>(null);
  const [results, setResults] = useState<ScenarioResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workbookName, setWorkbookName] = useState('');
  const [snapshotName, setSnapshotName] = useState('');

  async function onWorkbookFile(file: File | undefined) {
    if (!file) return;
    try {
      setError(null);
      const raw = await readJsonFile(file);
      setWorkbook(parseWorkbookJson(raw));
      setWorkbookName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onSnapshotFile(file: File | undefined) {
    if (!file) return;
    try {
      setError(null);
      const raw = await readJsonFile(file);
      setSnapshot(parseLoanSnapshotJson(raw));
      setSnapshotName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function runTests() {
    if (!workbook || !snapshot) {
      setError('Load both workbook.json and loan-snapshot.json first.');
      return;
    }
    setError(null);
    setResults(executeAllScenarios(workbook, snapshot));
  }

  return (
    <div className="app">
      <header>
        <h1>Encompass Unit Tests — Work Shell</h1>
        <p>Load workbook + loan snapshot JSON files. No Encompass API.</p>
      </header>

      <section className="panel">
        <div className="file-row">
          <label>
            Workbook JSON
            <br />
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => onWorkbookFile(e.target.files?.[0])}
            />
          </label>
          <label>
            Loan snapshot JSON
            <br />
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => onSnapshotFile(e.target.files?.[0])}
            />
          </label>
          <button type="button" onClick={runTests} disabled={!workbook || !snapshot}>
            Run all scenarios
          </button>
        </div>
        <p>
          {workbookName && <>Workbook: <strong>{workbookName}</strong> · </>}
          {snapshotName && <>Snapshot: <strong>{snapshotName}</strong></>}
        </p>
        {error && <p className="error">{error}</p>}
      </section>

      {results && (
        <section className="panel">
          <h2>Results</h2>
          {results.map((scenario) => (
            <div key={scenario.testNumber} className="scenario">
              <h3 className={statusClass(scenario.passed, scenario.skipped)}>
                Test {scenario.testNumber}: {scenario.description} —{' '}
                {scenario.skipped ? 'SKIPPED' : scenario.passed ? 'PASS' : 'FAIL'}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.steps.map((step, idx) => (
                    <tr key={idx}>
                      <td>{step.step}</td>
                      <td>{step.action}</td>
                      <td>{step.target}</td>
                      <td>{step.status}</td>
                      <td>{step.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
