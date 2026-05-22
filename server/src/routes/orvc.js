const db = require('../db');

// ORVC columns returned in rows endpoint
const ORVC_COLUMNS = [
  'SERNR', 'OKFLAG', 'SHIPMARK', 'INVMARK', 'ORDDATE', 'LOCATION',
  'CUSTORDNR', 'CUSTCODE', 'ADDR0', 'OFFICIALSERNR', 'LASTSHIPDATE',
  'ORDERCLASS', 'SUM4', 'CUSTOMSTATUSFLAGTEXT', 'CUSTOMSTATUSFLAG',
  'FEEDBACKSTATUS', 'WAITINGFORITEMSDATE', 'WAITINGFORITEMSTIME',
  'TRANSPORTNUMBER', 'PHONE', 'NPPHONE', 'rdbCOMMENT', 'SALESMAN',
  'COMMENT2', 'COMMENT3', 'COMMENT4',
  'SHVC_first.SORTING'
];

const SAFE_ID = /^[a-zA-Z0-9_]+$/;

function addSortingJoin(query) {
  query.joinRaw(`outer apply (
    SELECT TOP 1 SORTING
    FROM SHVC WITH (NOLOCK)
    WHERE compno = ORVC.compno
      AND ORDERNR = ORVC.SERNR
      AND SORTING IS NOT NULL AND SORTING != ''
    ORDER BY SORTING
  ) SHVC_first`);
}

// Parse filter expression: "CLOSED==0 and CUSTOMSTATUSFLAG<>9 and ..."
// Also handles: SHVC_first.SORTING==`ОТГРУЖЕНО`
function applyFilterExpr(query, expr) {
  const clauses = expr.split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
  const equalsMap = new Map();
  const notEqualsMap = new Map();

  for (const clause of clauses) {
    const m = clause.match(/^([a-zA-Z0-9_.]+)\s*(==|!=|<>|like)\s*(.+)$/);
    if (!m) continue;
    const rawCol = m[1];
    const op = m[2];
    const valRaw = m[3];

    // Resolve qualified column names
    const col = rawCol === 'SHVC_first.SORTING' ? 'SHVC_first.SORTING' : rawCol;
    if (rawCol !== 'SHVC_first.SORTING' && !SAFE_ID.test(rawCol)) continue;

    let val = valRaw;
    if (/^\d+$/.test(valRaw)) val = Number(valRaw);
    else if (/^["'`].*["'`]$/.test(valRaw)) val = valRaw.slice(1, -1);

    if (op === 'like') {
      query.where(col, 'like', val);
    } else if (op === '==') {
      if (!equalsMap.has(col)) equalsMap.set(col, []);
      equalsMap.get(col).push(val);
    } else {
      if (!notEqualsMap.has(col)) notEqualsMap.set(col, []);
      notEqualsMap.get(col).push(val);
    }
  }

  for (const [col, vals] of equalsMap) {
    if (vals.length > 1) query.whereIn(col, vals);
    else query.where(col, vals[0]);
  }
  for (const [col, vals] of notEqualsMap) {
    if (vals.length > 1) query.whereNotIn(col, vals);
    else query.whereNot(col, vals[0]);
  }
}

// Apply all common filters to a query builder
function applyFilters(query, params) {
  const { compno, salesgroup, salesman, ownsalesman, filter, searchstr } = params;

  if (compno !== undefined) {
    const n = Number(compno);
    if (!Number.isNaN(n)) query.where('ORVC.compno', n);
  }
  if (salesgroup) query.where('SALESGROUP', String(salesgroup).trim());
  if (salesman) query.where('SALESMAN', String(salesman).trim());
  if (ownsalesman) query.where('SALESMAN', String(ownsalesman).trim());

  if (filter && String(filter).trim()) {
    applyFilterExpr(query, String(filter));
  }

  if (searchstr && String(searchstr).trim()) {
    const raw = String(searchstr).replace(/\+/g, ' ').trim();
    const ftsTerm = raw.replace(/["\*\?\~\^\(\)\:]/g, ' ').trim();
    query.where(function () {
      this.orWhereRaw(
        'CONTAINS((ADDR0, CUSTCODE, OFFICIALSERNR, LOCATION, ORDERCLASS, CUSTOMSTATUSFLAGTEXT, TRANSPORTNUMBER, rdbCOMMENT, SALESMAN, COMMENT2, COMMENT3, COMMENT4), ?)',
        [`"${ftsTerm}*"`]
      );
      this.orWhere('SERNR', 'like', `${raw}%`);
      this.orWhere('CUSTORDNR', 'like', `%${raw}%`);
      this.orWhere('NPPHONE', 'like', `%${raw}%`);
      this.orWhere('PHONE', 'like', `%${raw}%`);
    });
  }
}

// Format raw DB row for client consumption
function formatRow(row) {
  const dateFields = ['ORDDATE', 'LASTSHIPDATE'];
  for (const f of dateFields) {
    if (row[f]) {
      const d = new Date(row[f]);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        row[f] = `${yyyy}-${mm}-${dd}`;
      }
    }
  }
  const markMap = { 0: '', 1: '✓', 18: '✓' };
  if (row.OKFLAG !== undefined) row.OKFLAG = markMap[row.OKFLAG] ?? '';
  if (row.SHIPMARK !== undefined) row.SHIPMARK = markMap[row.SHIPMARK] ?? '';
  if (row.INVMARK !== undefined) row.INVMARK = markMap[row.INVMARK] ?? '';
  return row;
}

async function orvcRoutes(fastify) {
  // ── COUNT ─────────────────────────────────────────────────────────────────
  // GET /api/v2/orvc/count?compno=1&filter=...&searchstr=...
  fastify.get('/orvc/count', async (request, reply) => {
    const params = request.query;
    const needsSortingJoin = params.filter && /SORTING/i.test(String(params.filter));

    try {
      const query = db('ORVC');
      if (needsSortingJoin) addSortingJoin(query);
      applyFilters(query, params);

      const row = await query.count('* as cnt').first();
      return reply.send({ total: Number(row?.cnt) || 0 });
    } catch (err) {
      request.log.error({ err }, 'orvc/count failed');
      return reply.code(500).send({ error: 'DB query failed' });
    }
  });

  // ── ROWS ──────────────────────────────────────────────────────────────────
  // GET /api/v2/orvc/rows?offset=0&limit=50&orderBy=SERNR&order=desc&...filters
  fastify.get('/orvc/rows', async (request, reply) => {
    const { offset = 0, limit = 50, orderBy = 'SERNR', order = 'desc', ...params } = request.query;

    const safeOffset = Math.max(0, Number(offset));
    const safeLimit = Math.min(Math.max(1, Number(limit)), 200);
    const safeOrder = String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const safeOrderBy = SAFE_ID.test(String(orderBy)) ? String(orderBy) : 'SERNR';

    try {
      const query = db.select(ORVC_COLUMNS).from('ORVC');
      addSortingJoin(query);
      applyFilters(query, params);

      // Always add SERNR as tiebreaker
      if (safeOrderBy !== 'SERNR') {
        query.orderBy(safeOrderBy, safeOrder).orderBy('SERNR', safeOrder);
      } else {
        query.orderBy('SERNR', safeOrder);
      }

      query.limit(safeLimit).offset(safeOffset);

      const rows = await query;
      return reply.send({
        data: rows.map(formatRow),
        offset: safeOffset,
        limit: safeLimit
      });
    } catch (err) {
      request.log.error({ err }, 'orvc/rows failed');
      return reply.code(500).send({ error: 'DB query failed' });
    }
  });

  // ── SYNC ──────────────────────────────────────────────────────────────────
  // GET /api/v2/orvc/sync?...filters
  // Returns: { total, topIds[] }
  // topIds = first 100 SERNRs by current sort — client uses to detect added/removed top rows
  fastify.get('/orvc/sync', async (request, reply) => {
    const params = request.query;
    const needsSortingJoin = params.filter && /SORTING/i.test(String(params.filter));

    try {
      // COUNT query — no join needed unless SORTING is filtered
      const countQuery = db('ORVC');
      if (needsSortingJoin) addSortingJoin(countQuery);
      applyFilters(countQuery, params);
      const countPromise = countQuery.count('* as cnt').first();

      // TOP 100 SERNRs — minimal payload, just primary keys
      const topQuery = db.select('ORVC.SERNR').from('ORVC');
      if (needsSortingJoin) addSortingJoin(topQuery);
      applyFilters(topQuery, params);
      topQuery.orderBy('ORVC.SERNR', 'desc').limit(100);
      const topPromise = topQuery;

      const [countRow, topRows] = await Promise.all([countPromise, topPromise]);

      return reply.send({
        total: Number(countRow?.cnt) || 0,
        topIds: topRows.map(r => Number(r.SERNR))
      });
    } catch (err) {
      request.log.error({ err }, 'orvc/sync failed');
      return reply.code(500).send({ error: 'DB query failed' });
    }
  });

  // ── ORDER DETAIL ──────────────────────────────────────────────────────────
  // GET /api/v2/orvc/order?sernr=123&compno=1
  fastify.get('/orvc/order', async (request, reply) => {
    const { sernr, compno = 1 } = request.query;
    if (!sernr) return reply.code(400).send({ error: 'sernr required' });

    try {
      const [order, shipments] = await Promise.all([
        db('ORVC').where('SERNR', sernr).where('compno', compno).first(),
        db('SHVC').where('ORDERNR', sernr).where('compno', compno)
      ]);
      return reply.send({ sernr, compno, order: order ?? null, shipments: shipments ?? [] });
    } catch (err) {
      request.log.error({ err }, 'orvc/order failed');
      return reply.code(500).send({ error: 'DB query failed' });
    }
  });
}

module.exports = orvcRoutes;
