// Password hashing cost.
//
// Raised from 10 to 12: 10 is fine but 12 is the modern default and makes
// offline cracking of a stolen hash meaningfully more expensive, at a cost of
// a few tens of milliseconds per login — imperceptible to a user.
//
// Existing passwords keep working: bcrypt stores the cost inside the hash, so
// compare() still validates old 10-round hashes. They simply get re-hashed at
// 12 whenever a user next changes their password.
const BCRYPT_ROUNDS = 12;

module.exports = { BCRYPT_ROUNDS };
