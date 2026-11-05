// Contract checks for the search handler.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/search.js';

function call(query = {}, method = 'GET') {
  const headers = {};
  const res = {
    statusCode: 0,
    body: null,
    headers,
    setHeader(key, value) {
      headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
  handler({ method, query }, res);
  return res;
}

test('rejects methods other than GET', () => {
  const res = call({}, 'POST');
  assert.equal(res.statusCode, 405);
  assert.match(res.headers.Allow, /GET/);
});

test('answers preflight with 204', () => {
  const res = call({}, 'OPTIONS');
  assert.equal(res.statusCode, 204);
});

test('defaults to stars-desc with a 20 item page', () => {
  const res = call({});
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sort, 'stars-desc');
  assert.equal(res.body.limit, 20);
  assert.ok(res.body.results.length <= 20);
  assert.equal(res.body.total_matches, res.body.total_tracked);
});

test('empty or all filters mean no filter', () => {
  const total = call({}).body.total_matches;
  assert.equal(call({ category: '', lang: '', q: '' }).body.total_matches, total);
  assert.equal(call({ category: 'all', lang: 'all' }).body.total_matches, total);
});

test('resolves category slugs to display names', () => {
  const res = call({ category: 'dev-tools' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.category, 'Dev Tools');
  assert.ok(res.body.total_matches > 0);
});

test('unknown category is a 400 with the allowed list', () => {
  const res = call({ category: 'nonsense' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'invalid_category');
  assert.ok(res.body.error.allowed.includes('Dev Tools'));
});

test('unknown sort is a 400', () => {
  const res = call({ sort: 'random' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'invalid_sort');
});

test('paginates with offset and next_offset', () => {
  const first = call({ limit: 3 }).body;
  const second = call({ limit: 3, offset: 3 }).body;
  assert.equal(first.next_offset, 3);
  assert.equal(first.results.length, 3);
  assert.equal(second.results.length, 3);
  assert.notDeepEqual(
    first.results.map((r) => r.full_name),
    second.results.map((r) => r.full_name),
  );
});

test('reports snapshot age', () => {
  const res = call({});
  assert.equal(typeof res.body.data_age_seconds, 'number');
  assert.ok(res.headers['X-Data-Age']);
});

test('limit clamps to 100', () => {
  const res = call({ limit: 5000 });
  assert.equal(res.body.limit, 100);
  assert.ok(res.body.results.length <= 100);
});
