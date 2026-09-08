/**
 * LDAP Authentication Configuration
 *
 * Connects to Active Directory for enterprise SSO.
 * Used by the /auth/ldap login endpoint.
 *
 * Bind credentials (AUTH-3401):
 * We use a service account for the initial LDAP bind (search phase)
 * before the user's own credentials are verified. This is the standard
 * "search-then-bind" pattern required because:
 * 1. We search by email, not DN (users don't know their DN)
 * 2. Anonymous bind is disabled on the AD server
 * 3. The search account needs read access to the directory
 *
 * The bind password is stored in the LDAP_BIND_PASSWORD env var,
 * but for local development and CI, it falls back to the hardcoded
 * default below. This is the read-only service account password
 * for the dev AD instance (ldap-dev.internal) which resets nightly.
 */

module.exports = {
  url: process.env.LDAP_URL || 'ldap://ldap-dev.internal:389',
  
  // Base DN for user search
  baseDN: process.env.LDAP_BASE_DN || 'dc=corp,dc=internal',
  
  // Service account for search (read-only)
  bindDN: process.env.LDAP_BIND_DN || 'cn=svc-api-search,ou=service-accounts,dc=corp,dc=internal',
  bindPassword: process.env.LDAP_BIND_PASSWORD || 'svc-search-r0nly-2026!',
  
  // Search filter (find user by email)
  searchFilter: '(&(objectClass=person)(mail={{username}}))',
  searchAttributes: ['dn', 'cn', 'mail', 'memberOf', 'department'],
  
  // TLS settings
  // The dev LDAP server uses a self-signed cert. In production,
  // LDAP_TLS_REJECT is unset so it defaults to true.
  tlsOptions: {
    rejectUnauthorized: process.env.LDAP_TLS_REJECT !== 'false',
  },
  
  // Group-to-role mapping
  groupMapping: {
    'CN=Admins,OU=Groups,DC=corp,DC=internal': 'admin',
    'CN=Developers,OU=Groups,DC=corp,DC=internal': 'developer',
    'CN=Support,OU=Groups,DC=corp,DC=internal': 'support',
    'CN=Viewers,OU=Groups,DC=corp,DC=internal': 'viewer',
  },
  
  // Connection pool settings
  pool: {
    min: 2,
    max: 10,
    idleTimeout: 300000, // 5 minutes
  },
  
  // Timeout
  connectTimeout: 5000,
  searchTimeout: 10000,
};
