// This script configures Knex for connecting to the database.
// Load dotenv configuration
const config = require('./environment.js').default;

module.exports = {
    
    // For commication with the mobile app.
    mobile: {
        client: 'mysql',
        connection: {
            host: config.database_host,
            user: config.database_user_mobile,
            password: config.database_pass_mobile,
            database: config.database_name,
            port: config.database_port
        },
        pool: { min: 0, max: 7 }
    },
    
    // For communication with the website.
    staff: {
        client: 'mysql',
        connection: {
            host: config.database_host,
            user: config.database_user_staff,
            password: config.database_pass_staff,
            database: config.database_name,
            port: config.database_port
        },
        pool: { min: 0, max: 7 }
    }
}
