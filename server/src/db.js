require('dotenv').config();

const knex = require('knex')({
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
    options: {
      encrypt: false,
      enableArithAbort: true
    }
  },
  pool: { min: 0, max: 10 }
});

module.exports = knex;
