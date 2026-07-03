/**
 * Filter policies based on category and search query
 * @param {Array} policies - Array of policy objects
 * @param {string} category - Selected category
 * @param {string} searchQuery - Search query string
 * @returns {Array} Filtered policies
 */
export function filterPolicies(policies, category, searchQuery) {
  return policies.filter((p) => {
    // Filter by category
    const matchCategory = category === "Semua" || p.category === category;
    
    // Filter by search query
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));
    
    return matchCategory && matchSearch;
  });
}

/**
 * Sort policies by various criteria
 * @param {Array} policies - Array of policy objects
 * @param {string} sortBy - Sort criteria (title, date, category)
 * @returns {Array} Sorted policies
 */
export function sortPolicies(policies, sortBy = "id") {
  const sorted = [...policies];
  
  switch (sortBy) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "date":
      return sorted.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    case "category":
      return sorted.sort((a, b) => a.category.localeCompare(b.category));
    default:
      return sorted.sort((a, b) => a.id - b.id);
  }
}
