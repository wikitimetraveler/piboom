/**
 * ISS station world — modules, crew snapshot, live nadir.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchIssNow } from './planetarium-iss.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_PATH = path.join(__dirname, '..', 'data', 'planetarium', 'iss-modules.json');
const CREW_PATH = path.join(__dirname, '..', 'data', 'planetarium', 'iss-crew.json');

let _modules;
let _crew;

export function loadModules() {
  if (!_modules) {
    _modules = JSON.parse(fs.readFileSync(MODULES_PATH, 'utf8'));
  }
  return _modules;
}

export function loadCrew() {
  if (!_crew) {
    _crew = JSON.parse(fs.readFileSync(CREW_PATH, 'utf8'));
  }
  return _crew;
}

export function resetStationCache() {
  _modules = null;
  _crew = null;
}

export function parseStationQuery(query = {}) {
  const moduleId = String(query.module || query.moduleId || query.id || '')
    .trim()
    .toLowerCase();
  const modeRaw = String(query.mode || '').trim().toLowerCase();
  const mode = modeRaw === 'explode' || modeRaw === 'walk' || modeRaw === 'orbit' ? modeRaw : '';
  return { module: moduleId, mode };
}

export function findModule(id) {
  const catalog = loadModules();
  const needle = String(id || '').trim().toLowerCase();
  if (!needle) return null;
  return (catalog.modules || []).find((row) => row.id === needle) || null;
}

export function crewInModule(moduleId, crew = loadCrew()) {
  const needle = String(moduleId || '').trim().toLowerCase();
  const people = Array.isArray(crew?.people) ? crew.people : [];
  if (!needle) return people;
  return people.filter((p) => String(p.quartersModuleId || '').toLowerCase() === needle);
}

export async function getStationPage(query = {}, fetchImpl = globalThis.fetch, at) {
  const catalog = loadModules();
  const crew = loadCrew();
  const params = parseStationQuery(query);
  const focus = params.module ? findModule(params.module) : null;
  let now = null;
  try {
    now = await fetchIssNow(fetchImpl, at);
  } catch (_) {
    now = null;
  }
  return {
    name: catalog.name,
    kicker: catalog.kicker,
    lede: catalog.lede,
    credit: catalog.credit,
    modules: catalog.modules || [],
    crew,
    aboard: Array.isArray(crew?.people) ? crew.people.length : 0,
    focus,
    params,
    now,
  };
}

export default {
  loadModules,
  loadCrew,
  resetStationCache,
  parseStationQuery,
  findModule,
  crewInModule,
  getStationPage,
};
