/**
 * Sesión Email 1 vía URL (misma app, otra pestaña con otro usuario/rol).
 * ?e1_uid=2&e1_role=user | ?e1_uid=1&e1_role=admin | ?e1_uid=3&e1_role=administrativo
 * Si no hay query, se usan fallbacks (VITE_USER_ID / VITE_USER_ROLE).
 */
const VALID_ROLES = new Set(['user', 'admin', 'administrativo'])

function normalizeRole(r) {
  const s = String(r || 'user').trim().toLowerCase()
  return VALID_ROLES.has(s) ? s : 'user'
}

/**
 * @param {number} fallbackUserId
 * @param {string} [fallbackRole] - 'user' | 'admin' | 'administrativo' (antes se pasaba isAdmin boolean; se acepta por compat: true → admin)
 */
export function readEmail1IdentityFromSearch(fallbackUserId, fallbackRole = 'user') {
  if (typeof window === 'undefined') {
    const role = typeof fallbackRole === 'boolean' ? (fallbackRole ? 'admin' : 'user') : normalizeRole(fallbackRole)
    return {
      userId: fallbackUserId,
      role,
      isAdmin: role === 'admin',
      isAdministrativo: role === 'administrativo',
      canSelfSchedule: role === 'admin' || role === 'administrativo',
      fromUrl: false,
    }
  }
  const p = new URLSearchParams(window.location.search)
  const uidRaw = p.get('e1_uid')
  const roleRaw = p.get('e1_role')
  const hasUrl = uidRaw != null || roleRaw != null
  let userId = fallbackUserId
  let role =
    typeof fallbackRole === 'boolean' ? (fallbackRole ? 'admin' : 'user') : normalizeRole(fallbackRole)
  if (uidRaw != null) {
    const n = parseInt(uidRaw, 10)
    if (Number.isFinite(n) && n > 0) userId = n
  }
  if (roleRaw != null) {
    const lr = String(roleRaw).trim().toLowerCase()
    if (lr === 'admin') role = 'admin'
    else if (lr === 'administrativo') role = 'administrativo'
    else if (lr === 'user') role = 'user'
  }
  return {
    userId,
    role,
    isAdmin: role === 'admin',
    isAdministrativo: role === 'administrativo',
    canSelfSchedule: role === 'admin' || role === 'administrativo',
    fromUrl: hasUrl,
  }
}
