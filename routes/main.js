// Script that defines the routes used on the server, for both the mobile app
// and the website.
// ------------ Imports ------------

// Load the environment configuration.
const config = require('../utils/environment.js');

// Express and routers.
var express = require('express');
var router = express.Router();

// Bcrypt for hashing passwords.
const bcrypt = require('bcryptjs');

// The database connection.
const db = require('../utils/db');

// Load websocket information.
const sensorWebsockets = require('../websocket.js');

// For parsing CSV files.
var papaparse = require("papaparse");
var formidable = require('formidable');
var fs = require('fs');

// ------------ App code start ------------

// ------ Setup and functions ------

// Prints debug messages to console if the environment variable is set.
const DEBUG = config.default.debug || false;
function dprint(message) {
    if (DEBUG) {
        console.log(message);
    }
}

// Get the expiry time for a login. If not specified, use a day (86400 seconds)
// as the default.
const LOGIN_EXPIRY = config.default.login_expire_time ? config.default.login_expire_time : 86400;

// Number of rounds to use when hashing a password.
const SALT_ROUNDS = 10

module.exports = router;

/** Sends a success response to the client.
    This is used for the mobile app.
    @param res - (response) The response object;
    @param message - (string) The message to send to the client; and
    @param additionalContent - (object) Any additional content to send in the response, such as JSON data. If undefined, only the message is sent.
    */
function sendSuccess(res, message, additionalContent) {

    // Default content for the response is success == true and the message.
    defaultContent = {
            success: true,
            message: message
        }

    // If there's additional content, merge that with the default content.
    if (additionalContent) {
        content = {
            ...defaultContent,
            ...additionalContent
        }
        dprint("(main.js - sendSuccess) Sending:");
        dprint(content);
        res.status(200).json(content)

    // Otherwise just send the default content.
    } else {
        dprint("(main.js - sendSuccess) Sending:");
        dprint(defaultContent);
        res.status(200).json(defaultContent)
    }
}

/** Sends an error response to the client.
    This is used for the mobile app.
    @param res - (response) The response object;
    @param message - (string) The message to send to the client; and
    @param status - (integer) The status to send to the client. Defaults to 400.
    */
function sendError(res, message, status = 400) {

    // Content for the response is error == true and the message.
    content = {
            error: true,
            message: message
        }
    dprint("(main.js - sendError) Sending:");
    dprint(content);
    res.status(status).json(content)
}

// ------ Middleware ------

/** Used for routes that require a user to be logged in.
    Checks whether there is an active login and allows access to the route if so, otherwise sends back an error.
    @param req - (request) The request object;
    @param res - (response) The response object; and
    @param next - (function) The next step in the process; if the user is authorized, this will be processed next.
    */
const authorize = (req, res, next) => {
    dprint("(main.js - authorize) Attempting to check if a user is logged in.");

    // Get the current user's username and their session expiry.
    var username = req.session.username;
    var expiry = req.session.expires;

    // Verify the session and check expiration date.
    try {
        // If there is no username in the session, send the user back to the
        // home page.
        if (username === undefined) {
            var message = "Not authenticated - The current user is not logged in.";
            if (req.is('application/json')) {
                sendError(res, message, 401);
            } else {
                req.session.loginErrorMessage = message;
                res.redirect('/');
            }
            return;
        } else

        // If the date is past the expiry of the session, send an error.
        if (expiry !== undefined && expiry < Date.now()) {
            req.session.expires = undefined;
            req.session.username = undefined;
            var message = "Not authenticated - The current user's log in has expired.";
            if (req.is('application/json')) {
                sendError(res, message, 401);
            } else {
                req.session.loginErrorMessage = message;
                res.redirect('/');
            }
            return;
        }

        // If both of those conditions pass, check if this user exists and is
        // active.
        // Check if the user exists by querying the users table.
        req.db.from("users").select('*').where("username", "=", username)
            .then((users) => {

                // If they do, also check if they are an active user.
                if (users.length > 0) {
                    var user = users[0]

                    // If they are not, send an error.
                    if (user.active !== 1) {
                        req.session.expires = undefined;
                        req.session.username = undefined;
                        var message = "Not authenticated - The current user has not been activated.";
                        if (req.is('application/json')) {
                            sendError(res, message, 401);
                        } else {
                            req.session.loginErrorMessage = message;
                            res.redirect('/');
                        }
                        return;

                    // Otherwise, move on to their requested page.
                    } else {
                        next();
                    }

                // If the user does not exist, send an error.
                } else {
                    req.session.expires = undefined;
                    req.session.username = undefined;
                    var message = "Not authenticated - The current user does not exist.";
                    if (req.is('application/json')) {
                        sendError(res, message, 401);
                    } else {
                        req.session.loginErrorMessage = message;
                        res.redirect('/');
                    }
                    return;
                }
            })

            // Send any errors from the database call to the client.
            .catch((err) => {
                var message = "Not authenticated - An error occured while trying to determine if the current login is valid: " + err.message;
                if (req.is('application/json')) {
                    sendError(res, message, 401);
                } else {
                    req.session.loginErrorMessage = message;
                    res.redirect('/');
                }
                return;
            });

    // If there's a different error caught while checking the above, send that
    // to the client.
    } catch (e) {
        var message = "Not authenticated - An error occured while trying to determine if the current login is valid: " + e.message;
        if (req.is('application/json')) {
            sendError(res, message, 401);
        } else {
            req.session.loginErrorMessage = message;
            res.redirect('/');
        }
        return;
    }
}

/** Used for routes that need admin privledges.
    Checks if the current user is in the database with the admin role, and
    returns to the main page if they are not.
    Since this always runs after the authorize middlewear, we can assume that
    there is a valid user logged in.
    @param req - (request) The request object;
    @param res - (response) The response object; and
    @param next - (function) The next step in the process; if the user is authorized, this will be processed next.
    */
const adminOnly = (req, res, next) => {
    dprint("(main.js - adminOnly) Attempting to check if the current user is an admin.");

    // Get the current user's username.
    var username = req.session.username;

    // Get the user from the database.
    req.db.from("users").select('*').where("username", "=", username)
        .then((users) => {
            var user = users[0]

            if (user.role === "admin") {
                next();
            } else {
                var message = "Unauthorized - The current user is not an administrator.";
                if (req.is('application/json')) {
                    sendError(res, message, 403);
                } else {
                    req.session.loginErrorMessage = message;
                    res.redirect('/');
                }
                return;
            }
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            var message = "Unauthorized - An error occured while trying to determine the current login's administrator privledges: " + err.message;
            if (req.is('application/json')) {
                sendError(res, message, 403);
            } else {
                req.session.loginErrorMessage = message;
                res.redirect('/');
            }
            return;
        })
}

/** Clears all messages from the session.
    This is used on every web page when it is loaded, so that messages do not
    persist in the case of an error sending the user to an unexpected page.
    */
function clearMessages(req) {
    req.session.loginErrorMessage = undefined;
    req.session.submitSuccessMessage = undefined;
    req.session.submitErrorMessage = undefined;
    req.session.resetSuccessMessage = undefined;
    req.session.resetErrorMessage = undefined;
    req.session.csvScores = undefined;
}

// ------ Routes for both mobile and website ------

/** Logs in an existing user, if the correct credentials are given.
    Requires the database to be up in order to proceed.
    */
router.post("/login", db, function(req, res, next) {
    dprint("(main.js - route /login) Attempting to log in a user.");

    // Get the username and password.
    var username = req.body.username
    var password = req.body.password

    // Check if the user entered both. If not, send an error.
    if (!username || !password) {
        var message = "Request data incomplete - username and password needed.";
        if (req.is('application/json')) {
            sendError(res, message)
        } else {
            req.session.submitErrorMessage = message;
            res.redirect('loginForm');
        }
        return;
    }

    // Check if the user exists by querying the users table.
    req.db.from("users").select('*').where("username", "=", username)
        .then((users) => {

            // If they do, attempt to log them in.
            if (users.length > 0) {

                // Compare password hashes.
                var user = users[0]
                match = bcrypt.compareSync(password, user.password)

                // If the password is correct, check if the user is active.
                if (match) {

                    // If the user is not active, send an error to the
                    // client.
                    if (user.active !== 1) {
                        var message = "Cannot log in user " + username + " - they have not been activated.";
                        if (req.is('application/json')) {
                            sendError(res, message)
                        } else {
                            req.session.submitErrorMessage = message;
                            res.redirect('loginForm');
                        }
                        return;

                    // If the user is active, set the session on the client.
                    } else {

                        // Store the username and expiry time in the session.
                        req.session.username = username;
                        req.session.expires = Date.now() + (LOGIN_EXPIRY * 1000);
                        var message = "User " + username + " logged in with an expiry of " + LOGIN_EXPIRY + " seconds.";
                        if (req.is('application/json')) {
                            sendSuccess(res, message);
                        } else {
                            res.redirect('/');
                        }
                        return;
                    }

                // If the password was incorrect, send an error to the client.
                } else {
                    var message = "Cannot log in user " + username + " - password was incorrect.";
                    if (req.is('application/json')) {
                        sendError(res, message)
                    } else {
                        req.session.submitErrorMessage = message;
                        res.redirect('loginForm');
                    }
                    return;
                }

            // If the user does not exist, send an error to the client.
            } else {
                var message = "Cannot log in user " + username + " - they do not exist.";
                if (req.is('application/json')) {
                    sendError(res, message)
                } else {
                    req.session.submitErrorMessage = message;
                    res.redirect('loginForm');
                }
                return;
            }
    })

    // If there's an error during the database call, send it to the client.
    .catch((err) => {
        var message = "Error while trying to log in a user: " + err.message;
        if (req.is('application/json')) {
            sendError(res, message)
        } else {
            req.session.submitErrorMessage = message;
            res.redirect('loginForm');
        }
        return;
    })
})

/** Registers a new user, if all required credentials are given and they do not conflict with existing users.
    Requires the database to be up in order to proceed.
    */
router.post("/addUser", db, function (req, res, next) {
    dprint("(main.js - route /addUser) Attempting to create a user.");

    // Get the required fields from the client request.
    var email = req.body.email;
    var password = req.body.password;
    var house = req.body.house;
    var role = req.body.role;
    var username = req.body.username;
    var active = req.body.active;

    // If there is no username and password, send an error response to the
    // client.
    if (username === "" || username === undefined || password === "" || password === undefined) {
        if (req.is('application/json')) {
            sendError(res, "Please ensure that you specify a username and password.");
        } else {
            req.session.submitErrorMessage = "Please ensure that you specify a username and password for the user you wish to add.";
            res.redirect('userForm');
        }
    }

    // Make sure the active and role fields are correct for submitting to the
    // database.
    if (active === "true") {
        active = true;
    } else {
        active = false;
    }
    if (role !== "admin") {
        role = null;
    }

    // Make sure that we are not adding a user with the same username as
    // another.
    req.db.from("users").select('*').where("username", "=", username)
        .then((users) => {

            // If there is only one and their ID is equal to the ID being
            // deleted, do not proceed any further.
            if (users.length > 0) {
                var message = `The username ${username} is already in use by another user.`;
                if (req.is('application/json')) {
                    sendError(res, message);
                    return;
                } else {
                    req.session.submitErrorMessage = message;
                    res.redirect('userForm');
                    return;
                }
            }

            // Otherwise, add the user to the database.
            else {

                // Create a hashed version of the entered password.
                var hash = bcrypt.hashSync(password, SALT_ROUNDS)

                // Add to the database.
                req.db.from("users").insert({
                    email: email || null,
                    password: hash,
                    house: house && house !== 0 ? house : null,
                    role: role,
                    username: username,
                    active: active,
                    })

                    // Confirm the successful add.
                    .then(() => {
                        if (req.is('application/json')) {
                            sendError(res, `An account for ${username} was succesfully created.`);
                            return;
                        } else {
                            req.session.submitSuccessMessage = `Added user ${username} succsesfully.`;
                            res.redirect('userForm');
                            return;
                        }
                    })

                    // If there's an error during the database call, send it to
                    // the client.
                    .catch((err) => {
                        var message = "An error occured while trying to add a user: " + err.message;
                        if (req.is('application/json')) {
                            sendError(res, message);
                        } else {
                            req.session.submitErrorMessage = message;
                            res.redirect('userForm');
                        }
                    });
            }
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            var message = "An error occured while trying to add a user: " + err.message;
            if (req.is('application/json')) {
                sendError(res, message);
            } else {
                req.session.submitErrorMessage = message;
                res.redirect('userForm');
            }
        })
})

/** Logs out the user specified with the given token.
    If the token is invalid or already expired, this still counts as a successful log out
    */
router.all("/logout", function(req, res, next) {
    dprint("(main.js - route /logout) Attempting to log out a user.");

    // Verify if the user has a valid login and if it's expired.
    try {
        // If the user is not logged in at all, send a message saying so.
        if (req.session.username === undefined) {
            req.session.expires = undefined;
            req.session.username = undefined;
            var message = "This user is not logged in.";
            if (req.is('application/json')) {
                sendSuccess(res, message)
            } else {
                req.session.loginErrorMessage = message;
                res.redirect('/');
            }
            return;
        } else

        // If the expiry time is before the current time, send a message to the
        // client saying they are already logged out because of this.
        if (req.session.expires < Date.now()) {
            req.session.expires = undefined;
            req.session.username = undefined;
            var message = "This user's login has expired and they are already logged out.";
            if (req.is('application/json')) {
                sendSuccess(res, message);
            } else {
                req.session.loginErrorMessage = message;
                res.redirect('/');
            }
            return;

        // Otherwise, expire the token right now and send a message to the
        // client saying they are logged out.
        } else {
            req.session.expires = undefined;
            req.session.username = undefined;
            var message = "Logged out successfully.";
            if (req.is('application/json')) {
                sendSuccess(res, message);
            } else {
                req.session.loginErrorMessage = message;
                res.redirect('/');
            }
            return;
        }

    // If there's an error while checking the JWT, send it to the client.
    } catch (e) {
        sendError(res, "An error occured while trying to log out a user: " + e.message);
        return;
    }
})

/** Adjusts the score for a particular house.
    The house and number should be sent as part of the request body.
    */
router.post("/setHouseScores", db, authorize, function(req, res, next) {
    dprint("(main.js - route /setHouseScores) Attempting to set a house's score.");

    // Get the required fields from the client request.
    var house = req.body.house
    var score = req.body.score

    try {
        // Change the number in the database.
        req.db.from("houses").where({ id: house }).update({ score: score })

            // If changing the number is successful...
            .then((result) => {

                // Get the house's name from the database.
                var houseName = undefined;
                req.db.from("houses").select('*').where("id", "=", house).then((result => { houseName = result[0].name

                // Send a message to the client saying it was successful.
                var message = "Set score for " + houseName + " to " + score + " successfully.";
                if (req.is('application/json')) {
                    sendSuccess(res, message);
                } else {
                    req.session.submitSuccessMessage = message;
                    res.redirect('scoreForm');
                } }));
            })

            // Otherwise, send the client the error message.
            .catch((err) => {
                var message = "An error occured while trying to update the house's score in the database: " + err.message;
                if (req.is('application/json')) {
                    sendError(res, message);
                } else {
                    req.session.submitErrorMessage = message;
                    res.redirect('scoreForm');
                }
            });

    // Catch any errors that occured and send that to the client.
    } catch (e) {
        var message = "An error occured while trying to set a house's score: " + e.message;
        if (req.is('application/json')) {
            sendError(res, message);
        } else {
            req.session.submitErrorMessage = message;
            res.redirect('scoreForm');
        }
    }
})

// ------ Routes for website only ------

/** Starting page for the server site.
    If there was an issue with the current log in (e.g. it expired) it will show that here.
    */
router.get("/", function(req, res, next) {
    dprint("(main.js - route /) Loading home page.");

    // See if we have any message in the session.
    var loginErrorMessage = req.session.loginErrorMessage;

    // Clear all messages from the session.
    clearMessages(req);

    // Render the home page template.
    res.render("main_home", {title:"Example Compost app backend - Home", loggedIn:req.session.username !== undefined, loginErrorMessage:loginErrorMessage});
})

/** Web page for adjusting the scores of a particular house.
    Will show a success/error message depending on whether submitting successfully changed the scores.
    */
router.get("/scoreForm", db, authorize, function(req, res, next) {
    dprint("(main.js - route /scoreForm) Loading scores page.");

    // See if we have any messages in the session.
    var submitSuccessMessage = req.session.submitSuccessMessage;
    var submitErrorMessage = req.session.submitErrorMessage;
    var csvScores = req.session.csvScores ? req.session.csvScores : null;

    // Clear all messages from the session.
    clearMessages(req);

    // Get the house information from the database.
    req.db.from("houses").orderBy("id", "asc")
        .then((result) => {

            // Render the score form template.
            res.render("main_scoreForm", {title:"Example Compost app backend - House scores", data:result, submitSuccessMessage:submitSuccessMessage, submitErrorMessage:submitErrorMessage, csvScores:csvScores});
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            res.send("An error occured while trying to access the database:" + err.message)
        })
})

/** Web page for logging in.
    Will show an error message if the log in attempt was unsuccessful. */
router.get("/loginForm", function(req, res, next) {
    dprint("(main.js - route /loginForm) Loading login page.");

    // See if we have any message in the session.
    var submitErrorMessage = req.session.submitErrorMessage;

    // Clear all messages from the session.
    clearMessages(req);

    // Render the login form template.
    res.render("main_loginForm", {title:"Example Compost app backend - Login", submitErrorMessage:submitErrorMessage});
})

/** Web page for changing the password of the currently logged in user.
    Will show a success/error message depending on whether submitting successfully changed the password.
    */
router.get("/passwordForm", db, authorize, function(req, res, next) {
    dprint("(main.js - route /passwordForm) Loading change password page.");

    // See if we have any messages in the session.
    var submitSuccessMessage = req.session.submitSuccessMessage;
    var submitErrorMessage = req.session.submitErrorMessage;

    // Clear all messages from the session.
    clearMessages(req);

    // Render the password form template.
    res.render("main_passwordForm", {title:"Example Compost app backend - Change password", submitSuccessMessage:submitSuccessMessage, submitErrorMessage:submitErrorMessage});
})

/** Changes the password of an existing user.
    */
router.post("/changePassword", db, function(req, res, next) {
    dprint("(main.js - route /changePassword) Attempting to change a user's password.");

    // Get the old and new passwords.
    var username = req.session.username
    var oldPassword = req.body.oldPassword
    var newPassword1 = req.body.newPassword1
    var newPassword2 = req.body.newPassword2

    // If not all the passwords are sent, send an error message to the client.
    if (!oldPassword || !newPassword1 || !newPassword2) {
        var message = "Please enter all of the required passwords.";
        if (req.is('application/json')) {
            sendError(res, message)
        } else {
            req.session.submitErrorMessage = message;
            res.redirect('passwordForm');
        }
        return;
    }

    // If the two new passwords are not the same, send an error message to the
    // client.
    if (newPassword1 !== newPassword2) {
        var message = "New passwords are not the same.";
        if (req.is('application/json')) {
            sendError(res, message)
        } else {
            req.session.submitErrorMessage = message;
            res.redirect('passwordForm');
        }
        return;
    }

    // If the old and new passwords are the same, send an error message to the
    // client.
    if (oldPassword === newPassword1) {
        var message = "Old and new passwords are the same.";
        if (req.is('application/json')) {
            sendError(res, message)
        } else {
            req.session.submitErrorMessage = message;
            res.redirect('passwordForm');
        }
        return;
    }


    // Check if the user exists before trying to change their password.
    req.db.from("users").select('*').where("username", "=", username)
        .then((users) => {

            // If they do, check if the old password is correct.
            if (users.length > 0) {

                // Compare password hashes...
                var user = users[0]
                match = bcrypt.compareSync(oldPassword, user.password)

                // If the old password is correct, change to the new one.
                if (match) {

                    // Create the hash of the new password and insert it into
                    // the database.
                    var newPasswordHash = bcrypt.hashSync(newPassword1, SALT_ROUNDS)
                    req.db.from("users").where({ username: username }).update({ password: newPasswordHash })
                        .then((result) => {
                            var message = "Set new password for " + username + " successfully.";
                            if (req.is('application/json')) {
                                sendSuccess(res, message);
                            } else {
                                req.session.submitSuccessMessage = message;
                                res.redirect('passwordForm');
                            }
                        })

                        // if there was an error updating the password, send
                        // the message to the client.
                        .catch((err) => {
                            var message = "An error occured while trying to change a user's password in the database: " + err.message;
                            if (req.is('application/json')) {
                                sendError(res, message);
                            } else {
                                req.session.submitErrorMessage = message;
                                res.redirect('passwordForm');
                            }
                        });

                // If the password wasn't correct, send an error message to the
                // client.
                } else {
                    var message = "Cannot change the password for user " + username + " - old password was incorrect.";
                    if (req.is('application/json')) {
                        sendError(res, message)
                    } else {
                        req.session.submitErrorMessage = message;
                        res.redirect('passwordForm');
                    }
                }

            // If the user doesn't exist, send an error message to the client.
            } else {
                var message = "Cannot change the password for user " + username + " - they do not exist.";
                if (req.is('application/json')) {
                    sendError(res, message)
                } else {
                    req.session.submitErrorMessage = message;
                    res.redirect('passwordForm');
                }
            }
    })

    // If there's an error during the database call, send it to the client.
    .catch((err) => {
        var message = "Error while trying to change a user's password: " + err.message;
        if (req.is('application/json')) {
            sendError(res, message)
        } else {
            req.session.submitErrorMessage = message;
            res.redirect('passwordForm');
        }
    })
})

/** Web page for adding and adjusting compost sensors.
    Will show a success/error message depending on whether submitting successfully changed the data.
    */
router.get("/sensorForm", db, authorize, adminOnly, function(req, res, next) {
    dprint("(main.js - route /sensorForm) Loading sensors page.");

    // See if we have any messages in the session.
    var submitSuccessMessage = req.session.submitSuccessMessage;
    var submitErrorMessage = req.session.submitErrorMessage;
    var resetSuccessMessage = req.session.resetSuccessMessage;
    var resetErrorMessage = req.session.resetErrorMessage;

    // Clear all messages from the session.
    clearMessages(req);

    // Get the sensor information from the database.
    req.db.from("sensor_data_latest")
        .then((sensors) => {

            // If there is at least one sensor...
            if (sensors.length > 0) {

                // Get the websocket connection status for each sensor.
                for (var row in sensors) {
                    var id = sensors[row].id;
                    if (sensorWebsockets.clients[id] !== undefined) {
                        sensors[row].connected = (sensorWebsockets.clients[id].readyState === 1);
                    } else {
                        sensors[row].connected = false;
                    }
                }

                // Render the sensor form template with the sensor data.
                res.render("main_sensorForm", {title:"Example Compost app backend - Compost sensors", sensors:sensors, submitSuccessMessage:submitSuccessMessage, submitErrorMessage:submitErrorMessage, resetSuccessMessage:resetSuccessMessage, resetErrorMessage:resetErrorMessage});

            // Otherwise...
            } else {

                // Render the sensor form template.
                res.render("main_sensorForm", {title:"Example Compost app backend - Compost sensors", submitSuccessMessage:submitSuccessMessage, submitErrorMessage:submitErrorMessage, resetSuccessMessage:resetSuccessMessage, resetErrorMessage:resetErrorMessage});
            }
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            res.send("An error occured while trying to access the database:" + err.message)
        })
})

/** Attempts to reset the connections of sensors.
    Will show a success/error message depending on whether it was successful.
    */
router.post("/resetSensorConnections", db, authorize, adminOnly, function(req, res, next) {
    dprint("(main.js - route /resetSensorConnections) Attempting to reset websocket connections for sensors.");

    try {
        // Close all the websockets without a reconnection attempt.
        sensorWebsockets.closeAll(false);

        // Start all websockets again, starting with getting the authentication
        // details.
        sensorWebsockets.initAll()

            // If there were no errors, send the client a message. Since the
            // sockets may not have connected yet, the message will say that
            // refreshing is needed.
            .then(() => {
                var message = "Sensor connections have been reset. You may need to refresh the page to check if the connections were successful.";
                req.session.resetSuccessMessage = message;
                res.redirect('sensorForm');
            })

            // Otherwise, send the client the error that occured.
            .catch((err) => {
                var message = "An error occured while trying to reset sensor connections: " + err.message;
                req.session.resetErrorMessage = message;
                res.redirect('sensorForm');
            });

    // Catch any errors that occured and send that to the client.
    } catch (e) {
        var message = "An error occured while trying to reset sensor connections: " + e.message;
        req.session.resetErrorMessage = message;
        res.redirect('sensorForm');
    }
});

/** Adds a new sensor to the database. */
function addSensor(req, res, id, name, description) {

    // Check if the sensor already exists first.
    req.db.from("sensors").where({ id: id })
        .then((sensor) => {

            // If it does, do not do anything else.
            if (sensor.length > 0) {
                var message = "A sensor with that Thingsboard ID already exists in the database."
                req.session.submitErrorMessage = message;
                res.redirect('sensorForm');

            // Otherwise, attempt to add the sensor.
            } else {
                req.db.from("sensors").insert({ id: id, name: name, description: description }).then(() => {
                    sensorWebsockets.closeAll(false);
                    sensorWebsockets.initAll();
                    var message = `Added sensor ${name} to the database succsesfully. Sensor connections have been reset automatically. You may need to refresh the page to check if the connections were successful.`;
                    req.session.submitSuccessMessage = message;
                    res.redirect('sensorForm');
                })

                // If an error occured, send that to the client.
                .catch((err) => {
                    var message = "An error occured while trying to add a sensor to the database: " + err.message;
                    req.session.submitErrorMessage = message;
                    res.redirect('sensorForm');
                });
            }
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            var message = "An error occured while trying to add a sensor to the database: " + err.message;
            req.session.submitErrorMessage = message;
            res.redirect('sensorForm');
        });
}

/** Modifies an existing sensor. */
function updateSensor(req, res, originalId, id, name, description) {

    // If the ID is different, check if it already exists for another sensor.
    if (originalId !== id) {
        req.db.from("sensors").where({ id: id })
            .then((sensor) => {

                // If it does, do not do anything else.
                if (sensor.length > 0) {
                    var message = "A sensor with that Thingsboard ID already exists in the database."
                    req.session.submitErrorMessage = message;
                    res.redirect('sensorForm');

                // Otherwise, attempt to update the sensor.
                } else {
                    req.db.from("sensors").where({ id: originalId }).update({ id: id, name: name, description: description }).then(() => {

                        // Reset the sensor connections so that there is no
                        // invalid one. Since the sockets may not have
                        // connected yet, the message sent to the client will
                        // say that refreshing is needed.
                        sensorWebsockets.closeAll(false);
                        sensorWebsockets.initAll();
                        var message = `Updated sensor ${name} succsesfully. Sensor connections have been reset automatically. You may need to refresh the page to check if the connections were successful.`;
                        req.session.submitSuccessMessage = message;
                        res.redirect('sensorForm');
                    })

                    // If an error occured, send that to the client.
                    .catch((err) => {
                        var message = "An error occured while trying to update an existing sensor: " + err.message;
                        req.session.submitErrorMessage = message;
                        res.redirect('sensorForm');
                    });
                }
            })

            // If there's an error during the database call, send it to the client.
            .catch((err) => {
                var message = "An error occured while trying to update an existing sensor: " + err.message;
                req.session.submitErrorMessage = message;
                res.redirect('sensorForm');
            });
    }

    // Otherwise, no checking is required.
    else {
        req.db.from("sensors").where({ id: originalId }).update({ name: name, description: description }).then(() => {

                // Reset the sensor connections so that there is no invalid
                // one. Since the sockets may not have connected yet, the
                // message sent to the client will say that refreshing is
                // needed.
                sensorWebsockets.closeAll(false);
                sensorWebsockets.initAll();
                var message = `Updated sensor ${name} succsesfully. Sensor connections have been reset automatically. You may need to refresh the page to check if the connections were successful.`;
                req.session.submitSuccessMessage = message;
                res.redirect('sensorForm');
            })

            // If there's an error during the database call, send it to the client.
            .catch((err) => {
                var message = "An error occured while trying to update an existing sensor: " + err.message;
                req.session.submitErrorMessage = message;
                res.redirect('sensorForm');
            });
    }
}

/** Adds a sensor to the database, or sets the characterstics of an existing
    one.
    The required details should be sent as part of the request body.
    */
router.post("/setSensor", db, authorize, adminOnly, function(req, res, next) {
    dprint("(main.js - route /setSensor) Attempting to update a sensor.");

    // Get the required fields from the client request.
    var originalId = req.body.formOriginalId;
    var id = req.body.formId;
    var name = req.body.formName;
    var description = req.body.formDescription;

    // Check if the user filled in all required fields.
    if (!id || !name) {
        var message = "Please enter an ID and name for the sensor.";
        req.session.submitErrorMessage = message;
        res.redirect('sensorForm');
        return;
    }

    // If the original ID does not exist, we are adding a new sensor.
    if (!originalId || originalId === "") {
        dprint("(main.js - route /setSensor) This is an add operation.");
        addSensor(req, res, id, name, description);
    }

    // Otherwise, an existing one is being modified.
    else {
        dprint("(main.js - route /setSensor) This is an update operation.");
        updateSensor(req, res, originalId, id, name, description);
    }
});

/** Deletes a sensor from the database.
    The required details should be sent as part of the request body.
    */
router.post("/deleteSensor", db, authorize, adminOnly, function(req, res, next) {
    dprint("(main.js - route /deleteSensor) Attempting to delete a sensor.");

    // Get the required fields from the client request.
    var id = req.body.id;

    // Check that the ID was supplied.
    if (!id) {
        var message = "Please specify the sensor's ID that you wish to delete.";
        req.session.submitErrorMessage = message;
        res.redirect('sensorForm');
        return;
    }

    // Use a transaction so that either all data is deleted, or none is.
    req.db.transaction(function(trx) {
        dprint(`(main.js - route /deleteSensor) Entering transaction to delete sensor ${id}.`);

        // Delete from the sensor data table first.
        req.db.from("sensor_data").where({sensor_id: id}).del().transacting(trx)

            // Then delete from the sensors table.
            .then((result) => {
                dprint("(main.js - route /deleteSensor) Deleted " + result + " rows from sensor_data.");
                return req.db.from("sensors").where({id: id}).del().transacting(trx);
            })

            // Commit all changes if there were no errors.
            .then(trx.commit)

            // On an error, rollback the entire operation.
            .catch(trx.rollback);
    })
    .then(() => {

        // Reset the sensor connections so that there is no invalid one. Since
        // the sockets may not have connected yet, the message sent to the
        // client will say that refreshing is needed.
        sensorWebsockets.closeAll(false);
        sensorWebsockets.initAll();
        var message = `Deleted sensor ${id} succsesfully. Sensor connections have been reset automatically. You may need to refresh the page to check if the connections were successful.`;
        req.session.submitSuccessMessage = message;
        res.redirect('sensorForm');
    })

    // If there's an error during the database call, send it to the client.
    .catch((err) => {
        var message = "An error occured while trying to delete a sensor: " + err.message;
        req.session.submitErrorMessage = message;
        res.redirect('sensorForm');
    });
});

/** Web page for adding and adjusting users.
    Will show a success/error message depending on whether submitting successfully changed the data.
    */
router.get("/userForm", db, authorize, adminOnly, function(req, res, next) {
    dprint("(main.js - route /userForm) Loading users page.");

    // See if we have any messages in the session.
    var submitSuccessMessage = req.session.submitSuccessMessage;
    var submitErrorMessage = req.session.submitErrorMessage;

    // Clear all messages from the session.
    clearMessages(req);

    // Get the user information from the database.
    req.db.from("users").select('id', 'username', 'active', 'role')
        .then((users) => {

            // If there is at least one user...
            if (users.length > 0) {

                // Render the sensor form template with the user data.
                res.render("main_userForm", {title:"Example Compost app backend - Users", users:users, submitSuccessMessage:submitSuccessMessage, submitErrorMessage:submitErrorMessage});

            // Otherwise...
            // (This situation should never happen but exists for
            // completeness.)
            } else {

                // Render the sensor form template.
                res.render("main_userForm", {title:"Example Compost app backend - Users", submitSuccessMessage:submitSuccessMessage, submitErrorMessage:submitErrorMessage});
            }
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            res.send("An error occured while trying to access the database:" + err.message)
        })
})

/** Deletes a user from the database.
    The required details should be sent as part of the request body.
    Will send an error if the last admin user is being deleted.
    */
router.post("/deleteUser", db, authorize, adminOnly, function(req, res, next) {
    dprint("(main.js - route /deleteUser) Attempting to delete a user.");

    // Get the required fields from the client request.
    var id = req.body.id;

    // Check that the ID was supplied.
    if (id === "" || id === undefined) {
        var message = "Please specify the user's ID that you wish to delete.";
        req.session.submitErrorMessage = message;
        res.redirect('userForm');
        return;
    }

    // Make the ID an int since that is what it is in the database.
    id = parseInt(id);

    // Before attempting to delete anything, make sure the user being deleted
    // is not the only active administsrator.
    req.db.from("users").where({ role: "admin", active: 1 })
        .then((users) => {

            // If there is only one and their ID is equal to the ID being
            // deleted, do not proceed any further.
            if (users.length === 1 && users[0].id === id) {
                var message = "The last active administrator cannot be deleted.";
                req.session.submitErrorMessage = message;
                res.redirect('userForm');
                return;

            // Otherwise, continue to deletion.
            } else {

                // Use a transaction so that either all data is deleted, or none is.
                req.db.transaction(function(trx) {
                    dprint("(main.js - route /deleteUser) Entering transaction to delete user " + id);

                    // Delete from the user tabke.
                    req.db.from("users").where({id: id}).del().transacting(trx)

                        // Commit all changes if there were no errors.
                        .then(trx.commit)

                        // On an error, rollback the entire operation.
                        .catch(trx.rollback);
                    })

                    // Confirm the successful deletion.
                    .then(() => {
                        var message = `Deleted user ${id} succsesfully. If they are still logged in, attempting to use a function that requires authorisation will fail.`;
                        req.session.submitSuccessMessage = message;
                        res.redirect('userForm');
                    })

                    // If there's an error during the database call, send it to
                    // the client.
                    .catch((err) => {
                        var message = "An error occured while trying to delete a user: " + err.message;
                        req.session.submitErrorMessage = message;
                        res.redirect('userForm');
                    });
            }
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            var message = "An error occured while trying to delete a user: " + err.message;
            req.session.submitErrorMessage = message;
            res.redirect('userForm');
        });
});

/** Updates a user in the database.
    The required details should be sent as part of the request body.
    Will send an error if the last admin user is being demoted or deactivated,
    or when trying to change the username to one that's already being used.
    */
router.post("/updateUser", db, authorize, adminOnly, function(req, res, next) {
    dprint("(main.js - route /updateUser) Attempting to update a user.");

    // Get the required fields from the client request.
    var id = req.body.id;
    var username = req.body.username;
    var active = req.body.active;
    var role = req.body.role;

    // Check that the ID was supplied.
    if (id === "" || id === undefined) {
        var message = "Please specify the user's ID that you wish to modify.";
        req.session.submitErrorMessage = message;
        res.redirect('userForm');
        return;
    }

    // Check that the username was supplied.
    if (username === "" || username === undefined) {
        var message = "You cannot change a user's username to be blank.";
        req.session.submitErrorMessage = message;
        res.redirect('userForm');
        return;
    }

    // Make the ID an int since that is what it is in the database.
    id = parseInt(id);

    // Make sure the active and role fields are correct for submitting to the
    // database.
    if (active === "true") {
        active = true;
    } else {
        active = false;
    }
    if (role !== "admin") {
        role = null;
    }

    // Make sure that the only active administrator is not being demoted or
    // deactivated, or we are not changing someone's username to be the same as
    // another.
    req.db.from("users").select('*')
        .then((users) => {

            // If there is only one and their ID is equal to the ID being
            // modified, and the user attempted to demote or deactivate them,
            // do not proceed any further.
            var activeAdmins = users.filter((user) => {return (user.role === "admin" && user.active === 1)});
            if (activeAdmins.length === 1 && activeAdmins[0].id === id && (active !== true || role !== "admin")) {
                var message = "The last active administrator cannot be demoted or deactivated.";
                req.session.submitErrorMessage = message;
                res.redirect('userForm');
                return;
            }

            // Else if someone else already has the same username, do not
            // proceed any further.
            var otherSameUsername = users.find((user) => {return (user.username === username && user.id !== id)});
            if (otherSameUsername !== undefined) {
                var message = `The username ${username} is already in use by another user.`;
                req.session.submitErrorMessage = message;
                res.redirect('userForm');
                return;
            }

            // Otherwise, continue to update.
            else {
                req.db.from("users").where({ id: id }).update({ username: username, active: active, role: role })

                // Confirm the successful update.
                .then(() => {
                    var message = `Updated user ${id} succsesfully. If they are still logged in, attempting to use a function that requires authorisation will fail depending on what was changed.`;
                    req.session.submitSuccessMessage = message;
                    res.redirect('userForm');
                })

                // If there's an error during the database call, send it to
                // the client.
                .catch((err) => {
                    var message = "An error occured while trying to update a user: " + err.message;
                    req.session.submitErrorMessage = message;
                    res.redirect('userForm');
                });
            }
        })

        // If there's an error during the database call, send it to the client.
        .catch((err) => {
            var message = "An error occured while trying to update a user: " + err.message;
            req.session.submitErrorMessage = message;
            res.redirect('userForm');
        });
});

/** Attempts to parse a CSV file, and if it is from the Oliver loan system,
    determines whether any house points have been gained from returning
    caddies.
    */
router.post("/parseCsv", db, authorize, function (req, res, next) {
    dprint("(main.js - route /parseCsv) Attempting to parse an uploaded CSV.");

    // Set up Formidable to parse the incoming form.
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {

        // If there was no file submitted, send an error to the client.
        if (files.csv.size === 0) {
            req.session.submitErrorMessage = "Please choose a file to upload.";
            res.redirect('scoreForm');
            return;
        }

        // If there was an error in getting a file from the form, send an error
        // to the client.
        else if (err) {
            req.session.submitErrorMessage = "Failed to upload the specified file: " + err.message;
            res.redirect('scoreForm');
            return;

        // Otherwise, try to parse the file as a CSV.
        } else {
            var file = fs.createReadStream(files.csv.path);

            // Will hold the rows of data from the CSV.
            var data = [];
            papaparse.parse(file, {

                // If there is an error while reading the file as a CSV, send a
                // error to the client.
                error: function (err) {
                    req.session.submitErrorMessage = "Failed to parse the specified file as a CSV: " + err.message;
                    res.redirect('scoreForm');
                    return;
                },

                // For every row in the file, add the data to the array
                // variable.
                step: function(row) {
                    data.push(row.data);
                },

                // Once the file has been completely parsed...
                complete: function () {
                    // Check if the file is a CSV from Oliver, by checking the
                    // first row of the data. If it has the incorrect column
                    // headers, send an error to the client.
                    if (
                        data[0][0] !== "Title" ||
                        data[0][1] !== "Barcode" ||
                        data[0][2] !== "Personal Name" ||
                        data[0][3] !== "Family Name" ||
                        data[0][4] !== "Roll Class" ||
                        data[0][5] !== "Time Lent" ||
                        data[0][6] !== "Time Returned"
                    ) {
                        req.session.submitErrorMessage = "This is not a CSV file from Oliver.";
                        res.redirect('scoreForm');
                        return;

                    // Otherwise, continue.
                    } else {

                        // Get the list of houses from the database.
                        req.db.from("houses").select("id", "name").orderBy("id", "asc")
                            .then((houses) => {

                                // Store the points for each house from this
                                // file.
                                var scores = [];
                                // Check through each row returned in the
                                // database and each row in the CSV to see if
                                // someone from a house returned a caddy.
                                for (var rowDb of houses) {

                                    // Initalise for this house.
                                    scores[scores.length] =
                                        {
                                            id: rowDb.id,
                                            name: rowDb.name,
                                            score: 0
                                        }
                                    for (var rowCsv of data) {

                                        // For YSSC, Oliver uses the first four
                                        // letters of the house in all caps in
                                        // the Roll Class column. This is what
                                        // to look for to see if a caddy was
                                        // returned by a student in a certain
                                        // house.
                                        // Also, check if there is a value in
                                        // the Time Returned column, and if the
                                        // item is actually a compost bin.
                                        var houseCsv = rowCsv[4].toLowerCase().substring(0,4);
                                        var houseDb = rowDb.name.toLowerCase().substring(0,4);
                                        if (rowCsv[0] == "Example Compost Bin"
                                        && rowCsv[6] !== ""
                                        && houseCsv === houseDb) {
                                            console.log(`${rowDb.name} (${rowDb.id}) gets a point!`);
                                                scores[scores.length-1].score++;
                                        }
                                    }
                                }
                                req.session.submitSuccessMessage = "Successfully parsed the specified file as a CSV.";
                                req.session.csvScores = scores;
                                dprint("(main.js - route /parseCsv) Sending...");
                                dprint(scores);
                                res.redirect('scoreForm');
                                return;
                            })
                            .catch((err) => {
                                req.session.submitErrorMessage = "An error occured while trying to get houses from the database (while parsing CSV): " + err.message;
                                res.redirect('scoreForm');
                                return;
                            })
                    }
                }
            });
        }
    });
})

/** Adds to the scores allocated to multiple houses in the database at once.
    Originally intended to add the scores parsed from an Oliver CSV file.
    Because this comes from a (hidden) HTML form, it requires both a field with
    the total number of scores to change, and a set of corresponding id and
    score fields named with "id" and "score" respectively followed by an index
    number (without a space). E.g. the first set would be "id0" and "score0".
    */
router.post("/addToHouseScoresMultiple", db, authorize, function(req, res, next) {
    dprint("(main.js - route /addToHouseScoresMultiple) Attempting to increase multiple houses' scores.");

    // Get the required fields from the client request.
    var numScores = req.body.numScores;
    if (numScores === undefined) {
        var message = "Please specify the number of houses that you wish to add to.";
        req.session.submitErrorMessage = message;
        res.redirect('scoreForm');
        return;
    }
    var newScores = []

    try {
        // Get the houses to add to, and how much to add from the request body.
        for (let i = 0; i < numScores; i++) {
            newScores.push({
                id: parseInt(req.body[`id${i}`]),
                score: parseInt(req.body[`score${i}`])
            });
        }

        // Change the scores in the database.
        // Use a transaction so that either all data is updated, or none is.
        req.db.transaction(async trx => {
            dprint(`(main.js - route /addToHouseScoresMultiple) Entering transaction to add to ${numScores} scores.`);
            for (var newScore of newScores) {
                dprint(newScore);
                await trx("houses").where({id: newScore.id}).update({score: req.db.raw(`?? + ${newScore.score}`, ['score'])})
            }
        })
        // If changing the number is successful...
        .then(() => {

            // Send a message to the client saying it was successful.
            var message = `Successfully added to the scores for ${numScores} house(s).`;
            req.session.submitSuccessMessage = message;
            res.redirect('scoreForm');
        })

        // Otherwise, send the client the error message.
        .catch((err) => {
            var message = "An error occured while trying to update multiple houses' scores in the database: " + err.message;
            req.session.submitErrorMessage = message;
            res.redirect('scoreForm');
        });

    // Catch any errors that occured and send that to the client.
    } catch (e) {
        var message = "An error occured while trying to update multiple houses' scores in the database: " + e.message;
        req.session.submitErrorMessage = message;
        res.redirect('scoreForm');
    }
})

// ------ Routes for mobile only ------

/** Checks if the current token is valid and therefore the user is still logged in.
    Essentially, it sees if the authorize function proceeds to this route.
    */
router.post("/validateToken", authorize, function(req, res, next) {
    dprint("(main.js - route /validateToken) Reached this route, therefore the user is logged in.");
    sendSuccess(res, "This user is still logged in.")
})

/** Retrieves the current scores of each house.
    */
router.get("/getHouseScores", db, function(req, res, next) {
    dprint("(main.js - route /getHouseScores) Attempting to load house scores.");

    try {

        // Get the scores of all houses from the houses table.
        req.db.from("houses").select('*').orderBy("id", "asc")
            .then((houses) => {

                // If house scores were retrieved from the database, send them
                // to the client.
                if (houses.length > 0) {
                    sendSuccess(res, "Successfully retrieved scores of the houses.", { houses: houses });
                }

                // If there were no scores retrieved, send an error to the
                // client.
                else {
                    sendError(res, "Did not retrieve any scores of the houses.")
                }
            })

            // Catch any errors from that and throw it up to the catch below.
            .catch((err) => { throw err })

    // Catch any errors that occured and send that to the client.
    } catch (e) {
        sendError(res, "An error occured while trying to get the scores of the houses: " + e.message)
    }
})

/** Retrieves all compost sensors in the database.
    */
router.get("/getSensorList", db, function(req, res, next) {
    dprint("(main.js - route /getSensorList) Attempting to load the list of sensors.");

    try {

        // Get the list of all sensors from the database.
        req.db.from("sensors").select('*')
            .then((sensors) => {

                // If a list of sensors was retrieved from the database, send
                // it to the client.
                if (sensors.length > 0) {
                    sendSuccess(res, "Successfully retrieved the compost sensor list.", { sensors: sensors });
                }

                // If there was no list retrieved, send an error to the client.
                else {
                    sendError(res, "Did not retrieve the compost sensor list.")
                }
            })

            // Catch any errors from that and throw it up to the catch below.
            .catch((err) => { throw err })

    // Catch any errors that occured and send that to the client.
    } catch (e) {
        sendError(res, "An error occured while trying to get the compost sensor list: " + e.message)
    }
})

/** Retrieves all data for a specific sensor.
    */
router.post("/getSensorData", db, function(req, res, next) {
    dprint("(main.js - route /getSensorData) Attempting to load the sensors and their data.");

    // Get the sensor ID from the request.
    var sensor_id = req.body.sensor_id

    // If there was no sensor ID, send an error message to the client.
    if (!sensor_id) {
        var message = "Request data incomplete - sensor id needed.";
        sendError(res, message)
        return;
    }

    try {

        // Get the data for the speciifed sensor from the database.
        req.db.from("sensor_data").select('*').where("sensor_id", "=", sensor_id).orderBy('timestamp', 'desc')
            .then((sensor_data) => {

                // If a list of data for that sensor was retrieved from the
                // database, send it to the client.
                if (sensor_data.length > 0) {
                    sendSuccess(res, "Successfully retrieved compost sensor data for sensor " + sensor_id + ".", { sensor_data: sensor_data });
                }

                // If there was no data retrieved, send an error to the client.
                else {
                    sendError(res, "Did not retrieve compost sensor data for sensor " + sensor_id + ".")
                }
            })

            // Catch any errors from that and throw it up to the catch below.
            .catch((err) => { throw err })

    // Catch any errors that occured and send that to the client.
    } catch (e) {
        sendError(res, "An error occured while trying to get compost sensor data: " + e.message)
    }
})