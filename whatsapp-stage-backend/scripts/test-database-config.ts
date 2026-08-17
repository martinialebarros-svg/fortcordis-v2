import assert from "assert";
import { buildPostgresConfig } from "../src/config/database";

const secureUrl = "postgresql://user:password@db.example.test:5432/fortcordis?sslmode=require";

const defaultConfig = buildPostgresConfig(secureUrl, undefined);
assert.equal(defaultConfig.connectionString, secureUrl);
assert.equal(defaultConfig.ssl, undefined);

const verifiedConfig = buildPostgresConfig(secureUrl, "true");
assert.equal(verifiedConfig.connectionString, secureUrl);
assert.equal(verifiedConfig.ssl, undefined);

const selfSignedConfig = buildPostgresConfig(secureUrl, "false");
assert.equal(
  new URL(String(selfSignedConfig.connectionString)).searchParams.has("sslmode"),
  false
);
assert.deepEqual(selfSignedConfig.ssl, { rejectUnauthorized: false });

assert.throws(
  () => buildPostgresConfig(secureUrl, "invalid"),
  /must be true or false/
);
assert.throws(
  () =>
    buildPostgresConfig(
      "postgresql://user:password@db.example.test:5432/fortcordis?sslmode=disable",
      "false"
    ),
  /requires DATABASE_URL with sslmode=require/
);
assert.throws(
  () =>
    buildPostgresConfig(
      `${secureUrl}&sslrootcert=%2Fetc%2Fssl%2Fcustom-ca.pem`,
      "false"
    ),
  /cannot override explicit database certificates/
);

console.log("Database TLS configuration checks passed.");
