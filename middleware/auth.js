/**
 * Auth placeholder — Opción A: sin validación real.
 * Todas las peticiones pasan. Más adelante conectar JWT/sesión/LDAP aquí.
 */
function authOptional(req, res, next) {
  req.user = req.user || { id: null, email: 'anonimo@local' };
  next();
}

module.exports = { authOptional };
