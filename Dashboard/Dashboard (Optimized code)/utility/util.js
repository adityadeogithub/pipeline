function isAllowedRole(role, roles) {
  return roles.includes(role);
}

const { JWT_HASH_KEY } = process.env;
module.exports.hash_key = `${JWT_HASH_KEY}`;
module.exports.isAllowedRole = isAllowedRole;
