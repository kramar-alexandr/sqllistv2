const db = require('../db');

const IVVC_COLUMNS = [
  'SERNR', 'OKFLAG', 'INVDATE', 'OFFICIALSERNR', 'ORDERNR',
  'CUSTCODE', 'ADDR0', 'SUM4', 'INVTYPE', 'CURNCYCODE', 'INVALID',
  'SALESMAN', 'compno'
];

// Join ARVC to get aggregated payment status per invoice
function addARVCJoin(query) {
  query.joinRaw(`outer apply (
    SELECT SUM(RVAL) as AR_RVAL, MIN(DUEDATE) as AR_DUEDATE
    FROM ARVC WITH (NOLOCK)
    WHERE compno = IVVC.compno
      AND INVOICENR = IVVC.SERNR
  ) ar_agg`);
}

const SAFE_ID = /^[a-zA-Z0-9_]+$/;

function applyFilters(query, params) {
  const { compno, salesman, salesgroup, filter, searchstr } = params;

  if (compno !== undefined) {
    const n = Number(compno);
    if (!Number.isNaN(n)) query.where('IVVC.compno', n);
  }
  if (salesgroup) query.where('SALESGROUP', String(salesgroup).trim());
  if (salesman) query.where('SALESMAN', String(salesman).trim());

  if (filter && String(filter).trim()) {
    const clauses = String(filter).split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    for (const clause of clauses) {
      const m = clause.match(/^([a-zA-Z0-9_]+)\s*(==|!=|<>|like)\s*(.+)$/);
      if (!m || !SAFE_ID.test(m[1])) continue;
      const col = m[1];
      let val = m[3];
      if (/^\d+$/.test(val)) val = Number(val);
      else if (/^["'`].*["'`]$/.test(val)) val = val.slice(1, -1);

      if (m[2] === 'like') query.where(col, 'like', val);
      else if (m[2] === '==') query.where(col, val);
      else query.whereNot(col, val);
    }
  }

  if (searchstr && String(searchstr).trim()) {
    const raw = String(searchstr).replace(/\+/g, ' ').trim();
    query.where(function () {
      this.orWhere('SERNR', 'like', `${raw}%`);
      this.orWhere('ORDERNR', 'like', `${raw}%`);
      this.orWhere('CUSTCODE', 'like', `${raw}%`);
      this.orWhere('ADDR0', 'like', `%${raw}%`);
    });
  }
}

const TODAY_START = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function computeRowColor(row) {
  // Not posted — no color
  if (!row.OKFLAG || row.OKFLAG === 0) return '';

  const arRval = row.AR_RVAL != null ? Number(row.AR_RVAL) : null;

  // No AR record or fully paid
  if (arRval === null || arRval <= 0) return 'green';

  // Has outstanding balance (RVAL < SUM4 means partial payment was made)
  if (arRval < Number(row.SUM4 || 0)) {
    const arDue = row.AR_DUEDATE ? new Date(row.AR_DUEDATE) : null;
    if (arDue && arDue < TODAY_START()) return 'red';
    return 'yellow';
  }

  return '';
}

function formatRow(row) {
  // Compute color before transforming OKFLAG
  row.rowColor = computeRowColor(row);
  delete row.AR_RVAL;
  delete row.AR_DUEDATE;

  if (row.INVDATE) {
    const d = new Date(row.INVDATE);
    if (!isNaN(d.getTime())) {
      row.INVDATE = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  const markMap = { 0: '', 1: '✓', 18: '✓' };
  if (row.OKFLAG !== undefined) row.OKFLAG = markMap[row.OKFLAG] ?? '';
  row.CREDMARK = row.INVTYPE === 3 ? 'C' : '';
  delete row.INVTYPE;
  if (row.INVALID !== undefined) row.INVALID = row.INVALID ? '!' : '';
  return row;
}

async function ivvcRoutes(fastify) {
  // GET /api/v2/ivvc/count
  fastify.get('/ivvc/count', async (request, reply) => {
    try {
      const query = db('IVVC');
      applyFilters(query, request.query);
      const row = await query.count('* as cnt').first();
      return reply.send({ total: Number(row?.cnt) || 0 });
    } catch (err) {
      request.log.error({ err }, 'ivvc/count failed');
      return reply.code(500).send({ error: 'DB query failed' });
    }
  });

  // GET /api/v2/ivvc/rows?offset=0&limit=50&orderBy=SERNR&order=desc
  fastify.get('/ivvc/rows', async (request, reply) => {
    const { offset = 0, limit = 50, orderBy = 'SERNR', order = 'desc', ...params } = request.query;

    const safeOffset = Math.max(0, Number(offset));
    const safeLimit = Math.min(Math.max(1, Number(limit)), 200);
    const safeOrder = String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const safeOrderBy = SAFE_ID.test(String(orderBy)) ? String(orderBy) : 'SERNR';

    try {
      const query = db.select([...IVVC_COLUMNS, 'ar_agg.AR_RVAL', 'ar_agg.AR_DUEDATE']).from('IVVC');
      addARVCJoin(query);
      applyFilters(query, params);
      query.orderBy(safeOrderBy, safeOrder).limit(safeLimit).offset(safeOffset);

      const rows = await query;
      return reply.send({ data: rows.map(formatRow), offset: safeOffset, limit: safeLimit });
    } catch (err) {
      request.log.error({ err }, 'ivvc/rows failed');
      return reply.code(500).send({ error: 'DB query failed' });
    }
  });

  // GET /api/v2/ivvc/sync
  fastify.get('/ivvc/sync', async (request, reply) => {
    try {
      const countQuery = db('IVVC');
      applyFilters(countQuery, request.query);
      const countPromise = countQuery.count('* as cnt').first();

      const topQuery = db.select('IVVC.SERNR').from('IVVC');
      applyFilters(topQuery, request.query);
      topQuery.orderBy('IVVC.SERNR', 'desc').limit(100);

      const [countRow, topRows] = await Promise.all([countPromise, topQuery]);
      return reply.send({
        total: Number(countRow?.cnt) || 0,
        topIds: topRows.map(r => Number(r.SERNR))
      });
    } catch (err) {
      request.log.error({ err }, 'ivvc/sync failed');
      return reply.code(500).send({ error: 'DB query failed' });
    }
  });
}

module.exports = ivvcRoutes;
