async function lookupNutrition(client, queries, contexts, referenceSource) {
  if (referenceSource !== undefined && referenceSource !== 'fatsecret') throw new Error('Nutrition source must be fatsecret.');
  const { data, error } = await client.functions.invoke('nutrition-lookup', {
    body: { ...(contexts ? { mode: 'resolve', queries, contexts } : { mode: 'batch', queries }),
      ...(referenceSource ? { referenceSource } : {}) },
    signal: AbortSignal.timeout(65000),
  });
  if (error) {
    const response = error.context;
    const status = Number.isInteger(response?.status) ? ` (HTTP ${response.status})` : '';
    let detail = error.message || 'Request failed.';
    if (response && typeof response.text === 'function') {
      const text = await response.text().catch(() => '');
      try {
        const body = JSON.parse(text);
        if (typeof body?.error === 'string') detail = body.error;
        else if (typeof body?.message === 'string') detail = body.message;
      } catch {
        if (text.trim()) detail = text.trim().slice(0, 500);
      }
    }
    throw new Error(`Nutrition lookup failed${status}: ${detail}`);
  }
  if (!Array.isArray(data?.results)) throw new Error('Invalid nutrition response: expected results array.');
  return queries.map((query, index) => (contexts ? data.results[index] : data.results.find(item => item.query === query)) || {
    query, match: null, candidates: [], reason: 'No matching nutrition reference.',
  });
}

module.exports = { lookupNutrition };
