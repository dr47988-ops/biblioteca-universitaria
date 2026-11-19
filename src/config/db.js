
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en el archivo .env');
}

const certificado = fs.readFileSync(
  path.join(__dirname, '../../database/certs/prod-ca-2021.crt'),
  'utf8'
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: certificado,
    rejectUnauthorized: true
  },
  connectionTimeoutMillis: 10000
});

module.exports = pool;
