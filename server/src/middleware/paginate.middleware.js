/**
 * Pagination middleware — parses ?page= and ?limit= from query string and
 * attaches a `req.pagination` object for use in Supabase .range() calls.
 *
 * Defaults: page=1, limit=20. Maximum limit enforced: 100.
 *
 * Usage:
 *   const { paginate } = require('../middleware/paginate.middleware');
 *   router.get('/', authenticate, paginate(), controller.list);
 *
 * In controller:
 *   const { from, to, limit, page } = req.pagination;
 *   const { data, count } = await supabaseAdmin
 *     .from('table')
 *     .select('*', { count: 'exact' })
 *     .range(from, to);
 *   res.json({ data, pagination: { page, limit, total: count } });
 */
function paginate({ defaultLimit = 20, maxLimit = 100 } = {}) {
  return (req, res, next) => {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    req.pagination = { page, limit, from, to };
    next();
  };
}

module.exports = { paginate };
