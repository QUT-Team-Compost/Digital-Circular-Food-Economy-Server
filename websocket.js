// Script that defines the routes used on the server, for both the mobile app
// and the website.
// ------------ Imports ------------
const ws = require('ws');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const db = require('knex')(require('./utils/knexfile.js').staff);

// Load the environment configuration.
const config = require('./utils/environment.js');

// ------------ App code start ------------

// Configuration of reconnection attempts:
// - How many times to retry;
// - How long between retries; and
// - Whether to retry in the first place.
const maxRetries = 5;
const reconnectInterval = 5000;
var reconnect = false;

// Dictionary for storing all the current websockets.
var clientDict = {};

// Prints debug messages to console if the environment variable is set.
const DEBUG = config.default.debug || false;
function dprint(message) {
    if (DEBUG) {
        console.log(message);
    }
}

// Set the number of retries for Axios, which is used for connecting to
// Thingsboard and authenticating.
axiosRetry(axios, {
    retries: maxRetries,
    retryDelay: (retryCount) => {
        console.log(`Attempting to reconnect to Thingsboard to authenticate... (Attempt ${retryCount})`);
        return retryCount * reconnectInterval;
    }
});

/** Attempts to make a connection to the websocket for the specified
    Thingsboard device.
    @param token - (string) The authentication token for Thingsboard.
    @param device - (string) The Thingsboard ID of the device to connect to.
    @param numRetries - (integer) How many times this connection has attemped
        to connect.
    */
function connectWebsocket(token, device, numRetries) {
    
    // Create a new websocket.
    clientDict[device.id] = new ws(config.default.tb_base_ws_url + '/api/ws/plugins/telemetry?token=' + token);
    
    // When the websocket is opened, send a command to get the latest data.
    clientDict[device.id].on('open', () => {
    console.log(`Connected websocket for device ${device.id} (${device.name}).`);
        var object = {
            tsSubCmds: [
                {
                    entityType: "DEVICE",
                    entityId: device.id,
                    scope: "LATEST_TELEMETRY",
                    cmdId: 10
                }
            ],
            historyCmds: [],
            attrSubCmds: []
        };
      clientDict[device.id].send(JSON.stringify(object));
    });
    
    // When the websocket receives a new message...
    clientDict[device.id].on('message', function incoming(message) {
        console.log(`New message from websocket for device ${device.id} (${device.name})...`);
        dprint('Websocket received the following data:');
        dprint(message);
        
        // If we have the correct data, attempt to add that data to the
        // database.
        var response = JSON.parse(message);
        
        // If the response contained an error...
        if (response.errorCode !== 0) {
            console.log("Got an error response from the websocket: " + response.errorMsg);
            
        // If the response did not include any data...
        } else if (response.data === undefined || response.data === null) {
            dprint("No data in websocket message.");
            
        // If the response data contains all the required data properties, we
        // will assume it is a new set of telemetry data.
        // The expected data is as follows:
        //     mv: Voltage from methane sensor;
        //     mvmin: Minimum voltage from methane sensor in last interval;
        //     mvmax: Maximum voltage from methane sensor in last interval;
        //     st: Temperature from the location of the methane sensor;
        //     et: Temperature from outside of the sensor;
        //     h: Humidity;
        //     v: Current battery voltage (currently unused in app); and
        //     s: Voltage charge from solar panel (currently unused in app).
        // There are also two other properties that can be included but are
        // not saved, because they are not reliable or unknown:
        //     compensated_sensor_reading: Eventually will measure something
        //     that takes into account humidity and temperature; and
        //     t: Currently unknown.
        } else if (response.data.mv &&
                    response.data.mvmin &&
                    response.data.mvmax &&
                    response.data.st &&
                    response.data.et &&
                    response.data.h &&
                    response.data.v &&
                    response.data.s) {

            // Each property is actually made up of an array containing another
            // array with two elements: The timestamp and the actual value.
            // While the has a separate timestamp property, this value is not
            // accurate to the actual measurement. Therefore, the timestamp
            // from one of the properties is used - in this case, mv.
            var timestamp = new Date(response.data.mv[0][0]);
            
            // Check if we do not already have an entry for this device at
            // this time first.
            db.from("sensor_data").select('*').where("sensor_id", "=", device.id).andWhere("timestamp", "=", timestamp)
                .then((test) =>{
                    
                    // If so, don't do anything with this data.
                    if (test.length > 0) {
                        console.log(`Latest data for device ${device.id} (${device.name}) at time ${timestamp} already exists in the database.`);
                        
                    // If not, add the data to the database.
                    } else {
                        var mv = response.data.mv[0][1];
                        var mvmin = response.data.mvmin[0][1];
                        var mvmax = response.data.mvmax[0][1];
                        var st = response.data.st[0][1];
                        var et = response.data.et[0][1];
                        var h = response.data.h[0][1];
                        var v = response.data.v[0][1];
                        var s = response.data.s[0][1];
                        db.from("sensor_data").insert({
                            sensor_id: device.id,
                            timestamp: timestamp,
                            mv: mv,
                            mvmin: mvmin,
                            mvmax: mvmax,
                            compensated_sensor_reading: compensated_sensor_reading,
                            st: st,
                            et: et,
                            t: t,
                            h: h,
                            v: v,
                            s: s
                        }).then(() => {console.log(`Added data for sensor ${device.id} (${device.name}) at time ${timestamp} (UTC) successfully.`);})
                        .catch((err) => {console.log(`Error while attempting to add data for ${device.id} (${device.name}):${err.message}`);});
                    }
                });
                
        // Otherwise, we aren't sure what the new data is.
        } else {
            dprint("We don't have a full set of new sensor data.");
        }
    });
    
    // When the websocket encounters an error...
    clientDict[device.id].on('error', function incoming(message) {
        console.log('Websocket encountered an error: %s', message);
    });
    
    // When the websocket is closed, attempt to reconnect if these are the
    // right conditions. If there is no reconnection, the websocket object is
    // destroyed.
    clientDict[device.id].on('close', function() {
        console.log(`Websocket for ${device.id} (${device.name}) was closed.`);
        clearTimeout(clientDict[device.id].pingTimeout);
        
        // If reconnects are allowed...
        if (reconnect === true) {
            
            // If this websocket hasn't attemped to connect the maximum number
            // of times...
            if (numRetries < maxRetries) {
                console.log(`Will attempt to reconnect after ${reconnectInterval/1000} seconds...`);
                setTimeout(connectWebsocket.bind(null, token, device, numRetries+1), reconnectInterval);
                
            // Otherwise don't try to reconnect again.
            } else {
                console.log(`Reached maximum number of retries while trying to connect to websocket for device ${device.id} (${device.name}).`);
                dprint(`Deleting websocket object for ${device.id} (${device.name})`);
                delete clientDict[device.id];
            }
        } else {
            dprint(`Deleting websocket object for ${device.id} (${device.name})`);
            delete clientDict[device.id];
        }
    });
    
    // When the websocket pings...
    clientDict[device.id].on('ping', function() {
        dprint(`Ping for ${device.id} (${device.name})...`);
        clearTimeout(clientDict[device.id].pingTimeout);

        // Set a timeout to wait for a certain length of time before
        // considering the connection as being down. In this case, this is the
        // default ping interval (30 seconds) with a 5 second grace period. If
        // this timeout is reached, terminates the websocket connection
        // immediately.
        clientDict[device.id].pingTimeout = setTimeout(() => {
            console.log(`Terminating Websocket for ${device.id} (${device.name}) due to ping failure.`);
            clientDict[device.id].terminate();
        }, 30000 + 5000);
    });
}

/** Connects to Thingsboard to get an authetication token.
    This is an async function and so can be used with .then and .catch.
    */
const connectAuth = async () => {
    // Use the base URL, username and password from the configuration.
    const url = config.default.tb_base_url + "/api/auth/login";
    const username = config.default.tb_login_username;
    const password = config.default.tb_login_password;
    
    // Attempt to connect to Thingsboard using Axios to get a token.
    try {
        const response = await axios.post(url, {"username": username, "password": password});
        
        // Get the data retrieved from the Axios call.
        const data = response.data;
        console.log("Logged into Thingsboard successfully!");
        dprint("Axios received the following data:");
        dprint(data);
        
        // Select all sensors from the database.
        db.from("sensors").select('*')
            .then((sensorList) => {
                
                // For each sensor in the database, attempt to make a
                // connection via websocket.
                for (let i = 0; i < sensorList.length; i++) {
                    connectWebsocket(data.token, sensorList[i], 0);
                }
                
                // Allow re-attempting connections on failure.
                reconnect = true;
            });
            
    // If the above encounters an error, show it on the console.
    } catch (error) {
        console.log(error);
    }
}

/** Closes all websocket connections.
    @param allowReconnect - (boolean) Whether the websockets should reconnect
        on their own.
    */
function closeAllWebsockets(allowReconnect = false) {
    reconnect = allowReconnect;
    dprint(`Closing all websockets (allowReconnect = ${allowReconnect})`);
    for (var client in clientDict) {
        console.log(`Attempting to close websocket client for ${client}.`);
        clientDict[client].close();
    }
}

module.exports = {
    initAll: connectAuth,
    clients: clientDict,
    closeAll: closeAllWebsockets
}