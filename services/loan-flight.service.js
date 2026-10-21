/**
 * Loan-flight deck, pilot progress, and copilot.
 * Seen question ids live in Postgres so a later flight does not repeat them.
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getPool } from './database.service.js';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';
import {
  PASS_RATIO,
  difficultyLabel,
  drawDeck,
  nextDifficulty,
  validateBank
} from './loan-flight-questions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANK_PATH = path.join(__dirname, '../data/loan-flight-question-bank.json');

const memoryPilots = new Map();
const memorySeen = new Map();
let bankCache = null;
let schemaReady = null;

function bad(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function cleanClientId(raw) {
  const id = String(raw || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw bad('clientId is required');
  return id;
}

async function loadBank() {
  if (bankCache) return bankCache;
  const bank = JSON.parse(await readFile(BANK_PATH, 'utf8'));
  const errors = validateBank(bank);
  if (errors.length) throw bad(`Question bank is invalid: ${errors[0]}`, 500);
  bankCache = bank;
  return bank;
}

async function ensureSchema(pool) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS loan_flight_question (
          id VARCHAR(80) PRIMARY KEY,
          unit VARCHAR(40) NOT NULL,
          difficulty INTEGER NOT NULL,
          payload JSONB NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS loan_flight_bank_meta (
          id INTEGER PRIMARY KEY,
          version INTEGER NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS loan_flight_pilot (
          client_id VARCHAR(64) PRIMARY KEY,
          difficulty INTEGER NOT NULL DEFAULT 1,
          flights INTEGER NOT NULL DEFAULT 0,
          best_ratio NUMERIC(6,4) NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS loan_flight_seen (
          client_id VARCHAR(64) NOT NULL,
          question_id VARCHAR(80) NOT NULL,
          correct BOOLEAN NOT NULL DEFAULT false,
          seen_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (client_id, question_id)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_loan_flight_seen_client ON loan_flight_seen (client_id, seen_at)');
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

async function seedBank(pool, bank) {
  const { rows } = await pool.query('SELECT version FROM loan_flight_bank_meta WHERE id = 1');
  if (Number(rows[0]?.version) === Number(bank.version)) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const q of bank.questions) {
      await client.query(
        `INSERT INTO loan_flight_question (id, unit, difficulty, payload)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (id) DO UPDATE
           SET unit = EXCLUDED.unit, difficulty = EXCLUDED.difficulty, payload = EXCLUDED.payload`,
        [q.id, q.unit, q.difficulty, JSON.stringify(q)]
      );
    }
    await client.query(
      `INSERT INTO loan_flight_bank_meta (id, version) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version`,
      [bank.version]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function questionsFromPool(pool, bank) {
  await seedBank(pool, bank);
  const { rows } = await pool.query(
    'SELECT payload FROM loan_flight_question ORDER BY unit, difficulty, id'
  );
  if (!rows.length) return bank.questions;
  return rows.map((row) => (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload));
}

function shapeDeck(bank, questions, pilot, seenIds, source) {
  const maxLevel = Math.max(...bank.difficulties.map((d) => Number(d.level)));
  const difficulty = Math.min(maxLevel, Math.max(1, Number(pilot.difficulty) || 1));
  const unitIds = bank.units.map((u) => u.id);
  const drawn = drawDeck({
    bank: questions,
    unitIds,
    difficulty,
    seenIds,
    count: bank.perUnit
  });
  return {
    source,
    difficulty,
    maxLevel,
    passRatio: PASS_RATIO,
    perUnit: bank.perUnit,
    difficulties: bank.difficulties,
    label: difficultyLabel(difficulty, bank.difficulties),
    pilot: {
      difficulty,
      flights: Number(pilot.flights) || 0,
      bestRatio: Number(pilot.bestRatio) || 0,
      label: difficultyLabel(difficulty, bank.difficulties)
    },
    units: bank.units.map((unit) => ({
      id: unit.id,
      label: unit.label,
      questions: drawn[unit.id] || []
    }))
  };
}

async function deckFromPool(pool, bank, clientId) {
  await ensureSchema(pool);
  const questions = await questionsFromPool(pool, bank);
  const { rows } = await pool.query(
    'SELECT difficulty, flights, best_ratio FROM loan_flight_pilot WHERE client_id = $1',
    [clientId]
  );
  const pilot = {
    difficulty: rows[0]?.difficulty || 1,
    flights: rows[0]?.flights || 0,
    bestRatio: rows[0]?.best_ratio || 0
  };
  const seen = await pool.query(
    'SELECT question_id FROM loan_flight_seen WHERE client_id = $1 ORDER BY seen_at ASC, question_id ASC',
    [clientId]
  );
  return shapeDeck(bank, questions, pilot, seen.rows.map((r) => r.question_id), 'postgres');
}

function deckFromMemory(bank, clientId) {
  const pilot = memoryPilots.get(clientId) || { difficulty: 1, flights: 0, bestRatio: 0 };
  const seenIds = memorySeen.get(clientId) || [];
  return shapeDeck(bank, bank.questions, pilot, seenIds, 'file');
}

export async function getDeck(clientId) {
  const id = cleanClientId(clientId);
  const bank = await loadBank();
  const pool = getPool();
  if (!pool) return deckFromMemory(bank, id);
  try {
    return await deckFromPool(pool, bank, id);
  } catch (err) {
    console.warn(`loan flight deck fell back to the file bank: ${err.message}`);
    return deckFromMemory(bank, id);
  }
}

function cleanResults(results) {
  if (!Array.isArray(results)) return [];
  return results.slice(0, 200).map((row) => ({
    id: String(row?.id || '').slice(0, 80),
    correct: Boolean(row?.correct)
  })).filter((row) => row.id);
}

export async function completeFlight(body) {
  const clientId = cleanClientId(body.clientId);
  const bank = await loadBank();
  const maxLevel = Math.max(...bank.difficulties.map((d) => Number(d.level)));
  const results = cleanResults(body.results);
  const correct = results.filter((row) => row.correct).length;
  const total = Math.max(results.length, Number(body.total) || 0, 1);
  const ratio = correct / total;
  const current = Math.max(1, Number(body.difficulty) || 1);
  const difficulty = nextDifficulty(current, ratio, maxLevel);
  const pool = getPool();
  if (!pool) {
    const prev = memoryPilots.get(clientId) || { difficulty: 1, flights: 0, bestRatio: 0 };
    const seen = new Set(memorySeen.get(clientId) || []);
    for (const row of results) seen.add(row.id);
    memorySeen.set(clientId, [...seen]);
    memoryPilots.set(clientId, {
      difficulty,
      flights: (Number(prev.flights) || 0) + 1,
      bestRatio: Math.max(Number(prev.bestRatio) || 0, ratio)
    });
  } else {
    try {
      await ensureSchema(pool);
      for (const row of results) {
        await pool.query(
          `INSERT INTO loan_flight_seen (client_id, question_id, correct, seen_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (client_id, question_id)
           DO UPDATE SET correct = EXCLUDED.correct, seen_at = now()`,
          [clientId, row.id, row.correct]
        );
      }
      await pool.query(
        `INSERT INTO loan_flight_pilot (client_id, difficulty, flights, best_ratio, updated_at)
         VALUES ($1, $2, 1, $3, now())
         ON CONFLICT (client_id) DO UPDATE SET
           difficulty = EXCLUDED.difficulty,
           flights = loan_flight_pilot.flights + 1,
           best_ratio = GREATEST(loan_flight_pilot.best_ratio, EXCLUDED.best_ratio),
           updated_at = now()`,
        [clientId, difficulty, ratio]
      );
    } catch (err) {
      console.warn(`loan flight progress was not stored: ${err.message}`);
    }
  }
  return {
    difficulty,
    advanced: difficulty > current,
    label: difficultyLabel(difficulty, bank.difficulties),
    ratio,
    correct,
    total: results.length
  };
}

function coachFallback({ revealed, explain }) {
  if (revealed && explain) return explain;
  return 'I will not choose for you. Use the stage briefing and the gauges, then pick.';
}

export function replyBeforeReveal() {
  return coachFallback({ revealed: false });
}

export async function coach(body) {
  const message = String(body.message || '').trim().slice(0, 1000);
  if (!message) throw bad('message is required');
  const revealed = Boolean(body.revealed);
  const explain = revealed ? String(body.explain || '').slice(0, 1200) : '';
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!revealed || !explain || !openaiKey) {
    return { reply: coachFallback({ revealed, explain }), guideName: 'Captain Mara Voss', source: 'fallback' };
  }
  const system = `You are Captain Mara Voss, loan-file flight instructor on a synthetic training sim.
The pilot already answered. Rephrase ONLY the explanation below in under 70 words.
Do not add rules, numbers, or product names that are not in the explanation.
Product figures are this app's GSE catalog. They are training numbers, not a commitment to lend, and not DU, LPA, TOTAL, or GUS.
The flight score stays on the simulator. The GSE analyzer is a separate page opened from a button.`;
  const user = `Explanation:\n${explain}\n\nPilot asks: ${message}`;
  try {
    const model = new ChatOpenAI({
      modelName: resolveOpenAiAgentModel('LOAN_FLIGHT_ASSISTANT_MODEL'),
      temperature: 0.3,
      openAIApiKey: openaiKey
    });
    const response = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
    const reply = String(response?.content || '').trim() || coachFallback({ revealed, explain });
    try {
      await persistConversationTurn(
        String(body.clientId || 'loan-flight-anon').slice(0, 64),
        'loan-flight-captain',
        message,
        reply,
        'loan-flight'
      );
    } catch {
      /* memory optional */
    }
    return { reply, guideName: 'Captain Mara Voss', source: 'openai' };
  } catch (err) {
    console.warn(`loan flight copilot fallback: ${err.message}`);
    return { reply: coachFallback({ revealed, explain }), guideName: 'Captain Mara Voss', source: 'fallback' };
  }
}
