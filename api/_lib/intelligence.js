const strategicCommodities = new Set(['gold', 'tantalum', 'tin', 'copper', 'columbite']);

function score(record) {
  let value = 40;
  if (record.status === 'active') value += 20;
  if ((record.commodities || []).some((item) => strategicCommodities.has(String(item).toLowerCase()))) value += 20;
  if (Number(record.area_m2) > 1000000) value += 10;
  if (record.source === 'IAISMP') value += 8;
  return Math.min(99, value);
}
function potentialLabel(value) {
  const numeric = Number(value);
  if (numeric >= 85) return 'High Potential';
  if (numeric >= 70) return 'Medium Potential';
  return 'Lower Potential';
}
function freePreview(record) {
  return {
    id: record.id,
    licence_no: record.licence_no,
    operator: record.operator,
    state: record.state,
    lga: record.lga,
    commodities: record.commodities,
    status: record.status,
    potential_label: potentialLabel(record.ai_score ?? score(record))
  };
}
function freeSearchResults(results, limit = 3) {
  return results.slice(0, limit).map(freePreview);
}

function search(records, filters = {}) {
  const normalise = (value) => String(value || '').trim().toLowerCase();
  const query = normalise(filters.q);
  const state = normalise(filters.state);
  const commodity = normalise(filters.commodity);
  const status = normalise(filters.status);
  return records
    .filter((record) => (!query || [record.licence_no, record.operator, record.state, record.lga, ...record.commodities].join(' ').toLowerCase().includes(query))
      && (!state || record.state.toLowerCase() === state)
      && (!commodity || record.commodities.some((item) => item.toLowerCase() === commodity))
      && (!status || record.status === status))
    .map((record) => ({ ...record, ai_score: score(record) }))
    .sort((left, right) => right.ai_score - left.ai_score || left.licence_no.localeCompare(right.licence_no));
}

function analysis(record) {
  const strengths = [];
  const risks = ['Exact licence polygon and surveyed coordinates are not included in this record.', 'Geology, assays, environmental approvals and project economics require independent due diligence.'];
  const actions = ['Verify current title status directly with the issuing authority.', 'Obtain authoritative polygon/coordinates and confirm overlap constraints.', 'Request geological reports, sampling/assays and environmental documentation.'];
  if (record.status === 'active') strengths.push('Active title status in the captured source record.');
  else risks.unshift('Title is not active in the captured source record.');
  if (record.commodities.some((item) => strategicCommodities.has(item.toLowerCase()))) strengths.push('Commodity mix is relevant to the platform screening universe.');
  if (Number(record.area_m2) > 1000000) strengths.push('Large reported licence area supports further screening.');
  const value = score(record);
  return { licence: record.licence_no, operator: record.operator, score: value, decision: value >= 85 ? 'Advance to diligence' : value >= 70 ? 'Screen further' : 'Hold', strengths, risks, actions, provenance: { source: record.source, source_url: record.source_url, verified_at: record.verified_at } };
}

module.exports = { analysis, freePreview, freeSearchResults, potentialLabel, score, search };
