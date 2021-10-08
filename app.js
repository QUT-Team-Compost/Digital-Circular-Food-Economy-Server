#!/usr/bin/env node

// Script for the main entry point of the app.
// ------------ Imports ------------
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cors = require('cors');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cookieSession = require('cookie-session');
var app = express();

// Load the main router.
var mainRouter = require('./routes/main');

// Load the environment configuration.
const config = require('./utils/environment.js');

// ------------ App code start ------------

// Start up the pug view engine.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Set up the libraries we are using.
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Cookie session for storing session information securely.
app.use(cookieSession({
    secret: config.default.cookie_secret_key,
    signed: true,
}));

// Activate the main router.
app.use('/', mainRouter);

// Catch 404 and forward to error handler.
app.use(function(req, res, next) {
  next(createError(404));
});

// Error handler.
app.use(function(err, req, res, next) {
  // Set locals, only providing error in development.
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page.
  res.status(err.status || 500);
  res.render('error');
});

// Export this file as a module
module.exports = app;