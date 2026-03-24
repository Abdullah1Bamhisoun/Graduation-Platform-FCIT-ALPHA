/**
 * Normalize a course code from DB format to canonical hyphen format.
 * e.g. 'CPIS_498' → 'CPIS-498', 'CPIS_499' → 'CPIS-499'
 * Already-correct values like 'CPIS-498' pass through unchanged.
 */
function normalizeCourseCode(code) {
  if (!code) return code;
  return code.replace(/_/g, '-');
}

module.exports = { normalizeCourseCode };
