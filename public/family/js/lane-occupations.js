/**
 * Curated historical blurbs keyed by normalized occupation.job (lowercase).
 * New England / colonial–early republic framing where it fits the Lane record.
 */
const JOB_CONTEXT = {
  farmer:
    'In colonial and early American New England, “farmer” usually meant a household that worked arable land, pasture, and woodland for subsistence and market surplus. Families often combined crop rotation, livestock, and barter with local mills and trades. It was the most common recorded occupation in rural Lane lines and anchors much of the tree’s economic life.',
  husbandman:
    'Historically, “husbandman” denoted a small landholder or tenant who cultivated the soil—often with less status or acreage than a “yeoman” in older English usage. In New England records the term sometimes overlaps with farmer; both point to an agrarian household economy.',
  deacon:
    'Congregational and other Protestant churches elected deacons to assist the ministry—care of communion, charity, and church order. Holding the office signaled standing in the meetinghouse community and often went with literacy, respectability, and local leadership.',
  teacher:
    'District schools and private academies relied on men and women who taught reading, arithmetic, and sometimes Latin or surveying. Teaching could be seasonal or a step toward other professions; in the Lane data it appears often alongside farming and church roles.',
  carpenter:
    'Carpenters framed houses, barns, bridges, and meetinghouses—essential as towns spread. The trade combined hewing, joinery, and often onsite problem-solving; many carpenters also farmed part of the year.',
  shoemaker:
    'Cordwainers made and repaired footwear for households that rarely bought ready-made shoes. Shops were small; work could be urban or village-based and was easy to combine with tanning in family economies.',
  merchant:
    'Merchants bought and sold dry goods, lumber, West Indies imports, or local produce—linking farms to ports and credit networks. Success depended on trust, ledger discipline, and sometimes kin partnerships across towns.',
  tanner:
    'Tanners converted hides to leather using bark and lime—noisy, smelly, and often regulated to town edges. Leather fed shoemakers, saddlers, and harness makers; the trade paired naturally with small-scale shoemaking.',
  blacksmith:
    'Smiths forged iron into tools, hardware, nails, and repairs for agriculture and building. A village smith was a fixed point of maintenance; heavier work overlapped with wheelwrighting and farriery where horses mattered.',
  selectman:
    'New England towns elected selectmen yearly to administer roads, poor relief, warnings-out, and militia support—core local government before larger bureaucracies. Service marked community trust and time away from one’s trade.',
  clerk:
    'Clerks kept town, church, or business records—copying deeds, inventories, and meeting minutes. The title could mean a municipal officer, a shop clerk, or a trained scribe; literacy and neat hand were the real tools.',
  lawyer:
    'Country lawyers handled deeds, debt, probate, and occasional litigation as courts rode circuits. Reputation and connections mattered as much as statutes; many lawyers also held political or militia posts.',
  mason:
    'Masons laid stone and brick for chimneys, foundations, bridges, and public buildings. Seasonal frost and local stone shaped the work; masons often coordinated with carpenters on frames and roofs.',
  joiner:
    'Joiners specialized in interior woodwork—doors, window sash, stairs, and paneling—finer than rough framing. Their work dressed houses after the shell stood, overlapping with cabinetmaking in smaller places.',
  minister:
    'Ministers led worship, preached, catechized, and mediated community disputes. A settled minister could hold great moral authority; compensation mixed salary, firewood, and land grants depending on the parish.',
  physician:
    'Physicians in the long eighteenth and nineteenth centuries blended apprenticeship, humoral ideas, and emerging science. House calls, bleeding, and botanical remedies were common; many also served as town officers or veterans.',
  surveyor:
    'Surveyors laid out lots, roads, and disputed boundaries using chains and compasses—critical as settlement pushed into new townships. Mathematical skill tied surveying to teaching, engineering, and public office.',
  miller:
    'Millers ran gristmills and sawmills, converting grain to flour and logs to boards for the local economy. Toll in kind (a share of grain) was typical; mill sites on streams were social and political hubs.',
  tailor:
    'Tailors cut and sewed coats, breeches, and gowns—often in shops or by itinerant work. Cloth might be customer-supplied; fittings tied tailors to seasonal fairs and military contracts in wartime.',
  cooper:
    'Coopers built staves and hoops for barrels, casks, and buckets—essential for shipping salt fish, cider, and grain. Demand rose wherever commerce and farms met warehouses and wharves.',
  wheelwright:
    'Wheelwrights built and repaired wheels, hubs, and sometimes wagons—pairing woodworking with iron tires set by heat. They supported farming haulage and stage traffic as roads improved.',
  'professional soldier':
    'A “professional soldier” in older records often meant long-service regulars or officers who identified military pay and campaigns as a career, distinct from short militia turns. Context in the Lane book may tie to colonial garrisons or later standing forces.',
  soldier:
    'Generic “soldier” tags usually reflect wartime enlistment or muster rolls without a fuller trade line. Militia, provincial, and continental service all appear in New England lineages; pair with military notes in the person record when present.',
  gentleman:
    '“Gentleman” in deeds and genealogies sometimes meant a man of independent means or genteel status rather than a craft label—use cautiously as a job title. It may reflect style of address as much as daily work.',
  housewife:
    '“Housewife” as an occupation label is rare in older imports; when it appears it usually signals unpaid domestic labor—textiles, food preservation, childcare, and farm work—that structured household survival alongside men’s recorded trades.',
  sexton:
    'Sextons cared for the churchyard—digging graves, maintaining the burying ground, and sometimes ringing bells. The office sat between manual labor and parish dignity, often held for many years.'
};

const FALLBACK_CONTEXT =
  'Recorded in the Lane genealogy import; add curated context later.';

let occupations = [];
let activeJobKey = '';

function memorialWallUrl(personId) {
  const id = personId != null ? String(personId).trim() : '';
  if (!id) return '/family/lane-memorial-wall.html';
  return `/family/lane-memorial-wall.html?personId=${encodeURIComponent(id)}`;
}

function findPersonInActiveOccupation(personId) {
  const occ = occupations.find((o) => o.jobKey === activeJobKey);
  if (!occ || !Array.isArray(occ.people)) return null;
  return occ.people.find((p) => String(p.id) === String(personId)) || null;
}

function openOccPersonModal(personId) {
  const p = findPersonInActiveOccupation(personId);
  if (!p) return;
  const titleEl = document.getElementById('occPersonModalTitle');
  const yearsEl = document.getElementById('occPersonModalYears');
  const wallBtn = document.getElementById('occPersonModalWallBtn');
  if (titleEl) titleEl.textContent = p.name || 'Person';
  if (yearsEl) {
    yearsEl.textContent = `${p.birthYear != null && p.birthYear !== '' ? p.birthYear : '?'} – ${
      p.deathYear != null && p.deathYear !== '' ? p.deathYear : '?'
    }`;
  }
  if (wallBtn) {
    wallBtn.href = memorialWallUrl(p.id);
  }
  const occModal = document.getElementById('occPersonModal');
  if (occModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(occModal).show();
  }
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

function contextFor(jobKey) {
  const text = JOB_CONTEXT[jobKey];
  return text || FALLBACK_CONTEXT;
}

function renderMeta(summary) {
  const el = document.getElementById('occMeta');
  if (!el) return;
  const distinct = summary.totalDistinctJobs ?? occupations.length;
  const tags = summary.totalJobTags ?? '—';
  el.textContent = `${distinct} distinct occupation labels • ${tags} total job tags in records`;
}

function renderJobList() {
  const host = document.getElementById('occJobList');
  if (!host) return;
  host.innerHTML = occupations
    .map(
      (o) => `
      <button type="button" class="occ-job-btn ${o.jobKey === activeJobKey ? 'active' : ''}" data-job-key="${esc(o.jobKey)}">
        <span>${esc(o.jobLabel)}</span>
        <span class="occ-count">${esc(o.count)}</span>
      </button>`
    )
    .join('');

  host.querySelectorAll('.occ-job-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeJobKey = btn.dataset.jobKey;
      renderJobList();
      renderDetail();
    });
  });
}

function renderDetail() {
  const occ = occupations.find((o) => o.jobKey === activeJobKey);
  const titleEl = document.getElementById('occDetailTitle');
  const countEl = document.getElementById('occDetailCount');
  const ctxEl = document.getElementById('occDetailContext');
  const peopleEl = document.getElementById('occPeople');

  if (!occ) {
    if (titleEl) titleEl.textContent = 'No selection';
    if (countEl) countEl.textContent = '';
    if (ctxEl) ctxEl.textContent = '';
    if (peopleEl) peopleEl.innerHTML = '';
    return;
  }

  if (titleEl) titleEl.textContent = occ.jobLabel;
  if (countEl) countEl.textContent = `${occ.count} people`;
  if (ctxEl) ctxEl.textContent = contextFor(occ.jobKey);

  if (peopleEl) {
    peopleEl.innerHTML = (occ.people || [])
      .map((p) => {
        const pid = p.id != null ? String(p.id) : '';
        const wallHref = memorialWallUrl(pid);
        const safeIdAttr = esc(pid);
        return `
      <div class="occ-person-row">
        <div class="occ-person-name-cell">
          <button type="button" class="occ-person-name-btn btn btn-link p-0 text-left" data-person-id="${safeIdAttr}">
            ${esc(p.name || 'Unknown')}
          </button>
        </div>
        <span class="occ-person-years">${esc(p.birthYear || '?')} – ${esc(p.deathYear || '?')}</span>
        <div class="occ-person-actions">
          <a class="btn btn-sm btn-outline-info occ-wall-link" href="${esc(wallHref)}" title="Memorial wall profile">
            <i class="bi bi-heart" aria-hidden="true"></i> Wall
          </a>
        </div>
      </div>`;
      })
      .join('');

    peopleEl.querySelectorAll('.occ-person-name-btn[data-person-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-person-id');
        if (id) openOccPersonModal(id);
      });
    });
  }
}

async function boot() {
  const summary = await getJson('/api/genealogy/occupations');
  occupations = summary.occupations || [];
  if (!occupations.length) throw new Error('No occupation data returned');
  activeJobKey = occupations[0].jobKey;
  renderMeta(summary);
  renderJobList();
  renderDetail();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await boot();
  } catch (error) {
    console.error(error);
    const err = document.getElementById('occError');
    if (err)
      err.textContent = `Occupations page failed to load: ${error.message}. Verify GET /api/genealogy/occupations.`;
  }
});
