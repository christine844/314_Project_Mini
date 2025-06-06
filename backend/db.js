const { Pool } =  require('pg'); // Allows for handling of multiple database connections, reducing overhead

// Change these parameters to fit your local PgSQL database
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'event_management',
    password: 'password',
    port: 5432
});

// This allows for easy queries in other files.
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};

