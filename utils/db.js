// Script for setting up the database middleware.

// Load the Knex connection information from knexfile.js.
const options = require('./knexfile.js');
const knex_mobile = require('knex')(options.mobile);
const knex_staff = require('knex')(options.staff);

// Put the Knex connection information into the request, choosing between
// mobile and staff depending on the request type. application/json will
// usually be from the mobile app.
module.exports =(req, res, next) => {
    req.db = req.is('application/json') ? knex_mobile : knex_staff;
    next()
}