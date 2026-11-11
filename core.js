(function (root) {
  'use strict';
  function shuffle(input, random = Math.random) {
    const result = [...input];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function createSession(ids, mode, random = Math.random, { preserveOrder = false } = {}) {
    const unique = [...new Set(ids)];
    const selected = preserveOrder ? unique : shuffle(unique, random);
    if (!selected.length || !['learn', 'quiz'].includes(mode)) throw new Error('Nieprawidłowa sesja');
    return { version: 1, mode, ids: selected, queue: [...selected], current: null, skipped: [], reviewing: false, results: {}, stage: 'ready', choice: null, order: [] };
  }
  function advance(s, getAnswers, random = Math.random) {
    if (s.stage === 'done') return s;
    if (!s.queue.length && s.skipped.length) {
      s.queue = [...s.skipped]; s.skipped = []; s.reviewing = true;
    }
    if (!s.queue.length) { s.current = null; s.stage = 'done'; s.order = []; return s; }
    s.current = s.queue.shift();
    s.choice = null;
    s.order = shuffle(getAnswers(s.current).map((_, i) => i), random);
    s.stage = s.mode === 'learn' ? 'theory' : 'question';
    return s;
  }
  function answer(s, index, correct) {
    if (s.stage !== 'question' || !s.order.includes(index)) return false;
    s.choice = index;
    s.results[s.current] = index === correct;
    s.stage = 'feedback';
    return true;
  }
  function skip(s, getAnswers, random = Math.random) {
    if (s.mode !== 'learn' || s.reviewing || s.stage !== 'theory') return false;
    s.skipped.push(s.current);
    advance(s, getAnswers, random);
    return true;
  }
  function summary(s) {
    const completed = Object.keys(s.results).length;
    const correct = Object.values(s.results).filter(Boolean).length;
    return { completed, correct, total: s.ids.length, wrong: s.ids.filter(id => s.results[id] === false) };
  }
  function restore(value, items) {
    try {
      const s = typeof value === 'string' ? JSON.parse(value) : value;
      const lookup = new Map(items.map(item => [item.id, item]));
      if (!s || s.version !== 1 || !['learn', 'quiz'].includes(s.mode) || !['theory', 'recall', 'question', 'feedback', 'done'].includes(s.stage)) return null;
      if (!Array.isArray(s.ids) || !s.ids.length || s.ids.length > items.length || new Set(s.ids).size !== s.ids.length || !s.ids.every(id => lookup.has(id))) return null;
      if (typeof s.reviewing !== 'boolean' || !Array.isArray(s.queue) || !Array.isArray(s.skipped) || !s.results || typeof s.results !== 'object' || Array.isArray(s.results)) return null;
      if (!Object.entries(s.results).every(([id, val]) => s.ids.includes(id) && typeof val === 'boolean')) return null;
      if (s.mode === 'quiz' && (s.skipped.length || ['theory', 'recall'].includes(s.stage))) return null;
      if (s.stage === 'done') {
        if (s.current !== null || s.queue.length || s.skipped.length || Object.keys(s.results).length !== s.ids.length) return null;
      } else {
        if (!s.ids.includes(s.current) || !Array.isArray(s.order)) return null;
        const count = lookup.get(s.current).answers.length;
        if (s.order.length !== count || new Set(s.order).size !== count || !s.order.every(i => Number.isInteger(i) && i >= 0 && i < count)) return null;
        if (s.stage === 'feedback') {
          if (!s.order.includes(s.choice) || typeof s.results[s.current] !== 'boolean' || s.results[s.current] !== (s.choice === lookup.get(s.current).correct)) return null;
        } else if (s.choice !== null || Object.hasOwn(s.results, s.current)) return null;
      }
      const pending = [...s.queue, ...s.skipped, ...(s.current && s.stage !== 'feedback' ? [s.current] : [])];
      if (pending.some(id => !s.ids.includes(id) || Object.hasOwn(s.results, id)) || new Set(pending).size !== pending.length) return null;
      if (pending.length + Object.keys(s.results).length !== s.ids.length) return null;
      if (s.reviewing && s.skipped.length) return null;
      return s;
    } catch { return null; }
  }
  root.MaleKrokiCore = { shuffle, createSession, advance, answer, skip, summary, restore };
  if (typeof module !== 'undefined') module.exports = root.MaleKrokiCore;
})(typeof globalThis !== 'undefined' ? globalThis : window);
