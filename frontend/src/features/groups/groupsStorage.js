/**
 * Persistent storage for operational employee groups.
 *
 * Groups are stored in localStorage under a versioned key so future schema
 * changes can migrate cleanly. All functions are pure/synchronous — no React
 * imports, safe to call anywhere.
 *
 * Group shape:
 * {
 *   id:          string,   — stable unique ID (grp_<timestamp>_<random>)
 *   name:        string,   — display name ("Night Shift", "PP Camp")
 *   description: string,   — optional note
 *   color:       string,   — hex or CSS color for visual identity
 *   employees:   Array<{ id: number, name: string, dept_name: string }>,
 *   createdAt:   string,   — ISO timestamp
 *   updatedAt:   string,
 * }
 */

const STORAGE_KEY = 'camp_order_groups_v1';

export const GROUP_COLORS = [
  '#1677ff', // blue
  '#52c41a', // green
  '#fa8c16', // orange
  '#722ed1', // purple
  '#13c2c2', // teal
  '#eb2f96', // pink
  '#faad14', // gold
  '#ff4d4f', // red
];

// ── Low-level helpers ─────────────────────────────────────────────────────────

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(groups) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Storage quota exceeded — silently swallow (non-critical data)
  }
}

function generateId() {
  return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function now() {
  return new Date().toISOString();
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load all groups from storage. Returns a new array every call (safe to mutate). */
export function loadGroups() {
  return readAll();
}

/**
 * Create a new group and persist it.
 *
 * @param {{ name: string, description?: string, color?: string, employees?: Array }} data
 * @returns {object} — the created group
 */
export function createGroup({ name, description = '', color, employees = [] }) {
  const groups = readAll();
  // Auto-pick a color if not supplied (round-robin through palette)
  const assignedColor = color || GROUP_COLORS[groups.length % GROUP_COLORS.length];
  const group = {
    id:          generateId(),
    name:        name.trim(),
    description: description.trim(),
    color:       assignedColor,
    employees,
    createdAt:   now(),
    updatedAt:   now(),
  };
  groups.push(group);
  writeAll(groups);
  return group;
}

/**
 * Update an existing group's metadata (name, description, color).
 * Does NOT touch the employee list — use addEmployee / removeEmployee for that.
 *
 * @param {string} id
 * @param {{ name?: string, description?: string, color?: string }} changes
 * @returns {object|null} — updated group or null if not found
 */
export function updateGroup(id, changes) {
  const groups = readAll();
  const idx    = groups.findIndex((g) => g.id === id);
  if (idx < 0) return null;
  const updated    = { ...groups[idx], ...changes, updatedAt: now() };
  groups[idx]      = updated;
  writeAll(groups);
  return updated;
}

/**
 * Permanently delete a group.
 *
 * @param {string} id
 * @returns {Array} — remaining groups
 */
export function deleteGroup(id) {
  const groups = readAll().filter((g) => g.id !== id);
  writeAll(groups);
  return groups;
}

/**
 * Add an employee to a group. No-op if already present.
 *
 * @param {string} groupId
 * @param {{ id: number, name: string, dept_name: string }} employee
 * @returns {object|null} — updated group or null if group not found
 */
export function addEmployeeToGroup(groupId, employee) {
  const groups = readAll();
  const idx    = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return null;
  const group  = groups[idx];
  if (group.employees.some((e) => e.id === employee.id)) return group; // already present
  const updated   = {
    ...group,
    employees: [...group.employees, { id: employee.id, name: employee.name, dept_name: employee.dept_name || '' }],
    updatedAt: now(),
  };
  groups[idx] = updated;
  writeAll(groups);
  return updated;
}

/**
 * Remove an employee from a group.
 *
 * @param {string} groupId
 * @param {number} employeeId
 * @returns {object|null} — updated group or null if group not found
 */
export function removeEmployeeFromGroup(groupId, employeeId) {
  const groups = readAll();
  const idx    = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return null;
  const group  = groups[idx];
  const updated = {
    ...group,
    employees: group.employees.filter((e) => e.id !== employeeId),
    updatedAt: now(),
  };
  groups[idx] = updated;
  writeAll(groups);
  return updated;
}

/**
 * Replace the entire employee list of a group at once.
 *
 * @param {string} groupId
 * @param {Array}  employees
 * @returns {object|null}
 */
export function setGroupEmployees(groupId, employees) {
  const groups = readAll();
  const idx    = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return null;
  const updated = { ...groups[idx], employees, updatedAt: now() };
  groups[idx]   = updated;
  writeAll(groups);
  return updated;
}
