/**
 * Count policies by category
 * @param {Array} policies - Array of policy objects
 * @returns {Object} Category counts
 */
export function countByCategory(policies) {
  const counts = {};
  policies.forEach((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  return counts;
}
