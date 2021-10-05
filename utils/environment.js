// Script for loading environment variables that are used elsewhere in the
// server.
// Orignally based on https://stackoverflow.com/a/58688649.
require('dotenv').config();

console.log("environment.js: Loading environment variables.")
const env = process.env;

const variables = {
    cookie_secret_key:                  env.COOKIE_SECRET_KEY,
    login_expire_time:                  parseFloat(env.LOGIN_EXPIRE_TIME),
    debug:                              (env.DEBUG ? env.DEBUG.toLowerCase() === "true" : false),
    tb_base_url:                        env.TB_BASE_URL,
    tb_login_username:                  env.TB_LOGIN_USERNAME,
    tb_login_password:                  env.TB_LOGIN_PASSWORD,
    tb_base_ws_url:                     env.TB_BASE_WS_URL
}

// If JawsDB (e.g. on Heroku) is being used, it automatically adds environment
// variables, so use those.
if (env.JAWSDB_DATABASE) {
    variables.database_user_staff =     env.JAWSDB_USERNAME;
    variables.database_user_mobile =    env.JAWSDB_USERNAME;
    variables.database_pass_staffe =    env.JAWSDB_PASSWORD;
    variables.database_pass_mobile =    env.JAWSDB_PASSWORD;
    variables.database_port =           undefined;
    variables.database_name =           env.JAWSDB_DATABASE;
    variables.database_host =           env.JAWSDB_HOST;
}

// If RDS on AWS is being used, it also automatically adds environment
// variables, so use those.
else if (env.RDS_DB_NAME) {
    variables.database_user_staff =     env.RDS_USERNAME;
    variables.database_user_mobile =    env.RDS_USERNAME;
    variables.database_pass_staff =     env.RDS_PASSWORD;
    variables.database_pass_mobile =    env.RDS_PASSWORD;
    variables.database_port =           env.RDS_PORT;
    variables.database_name =           env.RDS_DB_NAME;
    variables.database_host =           env.RDS_HOSTNAME;
}

// Else, use the user defined environment variables for the database.
else {
    variables.database_user_staff =     env.DATABASE_USER_STAFF;
    variables.database_user_mobile =    env.DATABASE_USER_MOBILE;
    variables.database_pass_staff =     env.DATABASE_PASS_STAFF;
    variables.database_pass_mobile =    env.DATABASE_PASS_MOBILE;
    variables.database_port =           env.DATABASE_PORT;
    variables.database_name =           env.DATABASE_NAME;
    variables.database_host =           env.DATABASE_HOST;
}

module.exports.default = variables;