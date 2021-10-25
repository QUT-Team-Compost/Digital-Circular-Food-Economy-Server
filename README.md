# Mobile App Companion for Circular Food Economy - Server Template

## Introduction

This is a template of a simple Node.js server that can be used as the backend of the mobile app template that can be found [here](https://github.com/QUT-Team-Compost/Digital-Circular-Food-Economy-App). This server is intended to store house scores for participating in the compost scheme, as well as connect to sensors on the Thingsboard platform. If these features are not included, the server is not necessary (and it can be modified for different purposes). The mobile app will run without contact with a server; this is only necessary for the aforementioned features.

The intention of the mobile app and server is to act as a companion for a circular food economy scheme that has been set up at primary or secondary school (Australian definitions). It is based upon the mobile app that is being used for the scheme at Yarrabilba State Secondary College, which has been released on both Android and iOS.

It also includes a web interface that allows a staff member to log in and alter the house scores.  The administrator can additionally manage the sensor connections, and all user accounts that can access the server pages - including whether they are regular or administrator accounts - and reset passwords.

More details on the sensors and how they're used with the server can be found under the Sensors section.

## Included source code

There are extensive comments included to allow you to get a further idea of how the code functions.

#### app.js
The entry point of the server application.

#### websocket.js
Sets up an autheticated connection to Thingsboard and creates a websocket connection to each Thingsboard sensor device defined in the database. The websocket connection will first download the latest data to add it to the database and then wait for further communication from the sensor server.

Functions to initalise all connections as well as close them are included, as well as an object containing all the ws objects identified by Thingsboard device ID.

The maximum number of connection attempts is 5 by default, and the websocket will attempt to reconnect if the initial connection failed, or it is closed through an error or another reason. Passing false in the function to close all websockets will prevent reconnection attempts.

### Bin

#### www
Modified version of the regular Express www file, with the ability to load certificate files and create an HTTPS connection.

### Routes

#### main.js
Contains all of the routes used by both the mobile app and the website, divided up into sections depending on one, the other, or both using them. For those that are used in both cases, they may send different responses depending on who made the request (identified by checking for an application/json type request, which comes from the mobile app).

While the addUser route was originally used for registering new users in the mobile app (and was previously named "register"), it is unused for this purpose and is only used for adding new users in the user management page. If logins on the app are re-implemented, that route can still be used. The validateToken route was also used by the mobile app and is unused at present (it is simply a call to the authorize middleware to check if the user is still logged in).

### SQL

#### database.sql
This file can be used to set up the database required for the server. It includes the schema itself, the tables, and the users. It is intended to be passed directly in the command line, but can also be imported using a GUI application, or you can copy each section into the database's interpreter.

Table definitions:
- houses: The table for each house in the school, to keep track of their scores.
    - id: (integer, required, primary key, auto increment) An ID number for the house.
    - name: (varchar, required, primary key, unique) A unique name for the house.
    - score: (decimal, required, defaults to 0) The current score of the house.
- sensor_data:
    - sensor_id: (varchar, required, primary key, foreign key) The Thingsboard ID for the sensor. This must be one of the sensors in the sensors table.
    - timestamp: (datetime, required, primary key) The date and time that the current set of data was taken on.
    - mv: (decimal, required) The voltage from the methane sensor. The actual value of methane in PPM is `(mv - 2 / 5) * 1000`.
    - mvmin: (decimal, required) The minimum voltage from the methane sensor since the last reading.
    - mvmax: (decimal, required) The maximum voltage from the methane sensor since the last reading.
    - compensated_sensor_reading: (decimal) Intended in future to measure something after taking humidity and temperature into account. Is currently not used and could be removed.
    - st: (decimal, required) The temperature at the probe of the methane sensor itself.
    - et: (decimal, required) The temperature outside the sensor's enclosure.
    - t: (decimal) Currently not known and unused. This could be removed.
    - h: (decimal, required) The humidity of the air oustide of the sensor (from the same location as the external temperature probe).
    - v: (decimal) The voltage of the sensor's battery. This is unused by the mobile app and could be removed.
    - s: (decimal) The voltage from the solar panels. This is unused by the mobile app and could be removed.
- sensors: Identifying data for the Thingsboard sensors that this server connects to.
    - id: (varchar, required, primary key) The Thingsboard ID for the sensor. This is used to connect to it via the Thingsboard API.
    - name: (varchar, required) An identifying name for the sensor.
    - description: (varchar, required, defaults to "Description not available.") A description for the sensor.
- users: The table for the users that can log into the website. There are some legacy columns that are not used at present, and are not required to be populated - it is up to you whether to keep them or not.
    - id: (integer, required, primary key, auto increment) An ID number for the user.
    - email: (varchar) The user's email address. Not currently used.
    - password: (varchar, required) The user's password hash.
    - active: (tinyint, required, defaults to 0) Whether the user account is active of not. Users that are not active cannot log in.
    - house: (integer, foreign key) The ID number of the house the user is assigned to. Is not required, but if specified, must be one of the houses in the houses table. Not currently used.
    - role: (varchar) Originally existed to put users into roles depending on whether they are a student, teacher or parent, and is not currently used.
    - username: (varchar, required, primary key) A username to identify the user, and used for logging in.
    
There is also a view, sensor_data_latest, used for the sensors page on the website. It joins each sensor in the sensors table with their latest data in the sensor_data table, identified by the timestamp. Only sensors that actually have data to join will be shown in this view.

### Utils

#### db.js
Defines the middleware for connecting to the database for a route. Will automatically use the mobile app connection defined in knexfile.js if the request is application/json (e.g. from the mobile app), otherwise will use the staff connection.

#### environment.js
Loads the required environment variables from .env and puts them in a variable to be accessed by other scripts. This has support for the environment variables for a JawsDB database on Heroku, and an RDS database on AWS.

#### knexfile.js
Defines the connection to the MySQL/MariaDB database for use with the Knex connection library. It is intended to define two connections, one for the server's website, and one for the mobile app (for security purposes).

If your database only has one user to connect with, this can be changed (though it will require changes in other files as well).

### Views
Contains the Pug templates used to render the website's pages.

#### error.pug
The default error template that comes with Express.

#### layout.pug
The default layout template that comes with Express.

#### main_home.pug
Template for the home page, which is shown on the index page of the server. It shows a link to the login page if the user is not logged in, otherwise it shows the various other pages that the user can navigate to, including logging out. It also displays a message if the user's login is invalid (e.g. their session has expired).

#### main_loginForm.pug
Template for the login page, which allows the user to log in. By default, there is a single username and password: "mobile_app_admin" and "compost2021" respectively.

#### main_passwordForm.pug
Template for the change password page. The server will validate whether the two new passwords are the same, or if not all fields were filled out, and display an error message if so. It will display that the password is changed if it was successful.

#### main_scoreForm.pug
Template for the house scores page, where house scores can be viewed and modified. The user sets the house score directly, rather than adding to it, which allows for them to be corrected if they are too high. It will also display messages depending on whether changing the score was successful or not.

This page also includes the capability of uploading a CSV file exported from the loan system Oliver. The file will be uploaded (temporarily) to the server and parsed to see if any of the houses have returned the bins (at the moment, it checks if the first four characters of the "Roll Class" column match the first four characters of one of the houses' names in the database) and tallies up points based on that. Submitting the parsed results will add these new points to the scores in the database.

#### main_sensorForm.pug
Template for the sensor page, which shows the latest data from each sensor in the database, as well as allowing the user to add, edit or delete sensors. The server will check whether the sensor data being submitted will cause an overlap of IDs, and if all fields have been supplied. A prompt will also appear when deleting to confirm the action.

Also present on the page is a button to reset the websocket connections, in case of any issues (as they will cease attempting to reconnect).

## Installation

Scripts are included to automatically install and set up the dependencies for the server on a Debian-based or Fedora-based Linux distribution. To install, make `setup_debian.sh` or `setup_fedora.sh` executable and then run them with root privledges.

If you wish to install manually on a Linux system (or encounter problems running the script), the process is as follows. These commands should be used in a Terminal window under root privledges.
1. Install Node.js using the package manager. As this application has been tested using Node 16.2.0, it is recommeneded to use the latest distribution. This will first require adding the URL using curl.
    - For Debian-based distributions:
        1. `curl -fsSL https://deb.nodesource.com/setup_16.x | bash -`
        1. `apt-get install -y nodejs`
    - For Fedora-based distributions:
        1. `curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -`
        1. `yum install -y nodejs`
1. Install `mysql-server` using the package manager. If you prefer to use MariaDB over MySQL, it should be able to be substituted in without issues.
    - Debian-based distributions: `apt-get install -y mysql-server`
    - Fedora-based distributions: `yum install -y mysql-server`
    - Once it is installed, start up the server process using `systemctl start mysqld`, and to have the process start on every boot, run the command `systemctl enable mysqld`.
1. Install the node packages required to run the server, using `npm ci` (or `npm install` if package-lock.json is not present) in the server's root directory.
1. Import the "database.sql" script in the SQL folder, using `mysql < ./SQL/database.sql` in the server's root directory, in order to set up the database with the required tables and data.
    - This includes a single user for the website, "yssc_app_admin", with the password "compost2021".
    - Note: This file should be modified in order to give the two database users a different password. The password for the website login can be changed after logging into the website.

To install on a Windows system, the process is as follows:
1. Download and install Node.js from https://nodejs.org/en/download. As this application has been tested using Node 16.2.0, it is recommended to use the latest release, rather than the LTS release.
1. Download and install MySQL Server from https://dev.mysql.com/downloads. If you prefer to use MariaDB over MySQL, it should be able to be substituted in without issues, and can be downloaded from https://downloads.mariadb.org/mariadb.cation.
    - The installation should give you an option to start the MySQL/MariaDB server as a service when booting; make sure to select this option, unless you want to manage when the server starts yourself.
1. In a Command Prompt window, install the node packages required to run the server, using `npm ci` (or `npm install` if package-lock.json is not present) in the server's root directory.
1. In a Command Prompt window, import the "database.sql" script in the SQL folder, using `mysql -u root -p < ./SQL/database.sql` in the server's root directory, in order to set up the database with the required tables and data (MySQL/MariaDB's bin folder should be on your PATH). You will be prompted to enter the root password.
    - Alternatively, if you installed MySQL/MariaDB Workbench, you can import the database using that.
    - This includes a single user for the website, "yssc_app_admin", with the password "compost2021".
    - Note: This file should be modified in order to give the two database users a different password. The password for the website login can be changed after logging into the website.

Once all these steps are complete, the server can be started through the command "npm start -- --run" in the server's root directory (however, it will only run successfully after the configuration in the next step).

## Configuration

The server also requires a configuration file called ".env" in the server's root directory. On Windows, a file with this name can be created through the Command Prompt through `echo. > .env` or by saving a file in a text editor with the name surrounded in double quotes.

This file should contain the following entries:
* DATABASE_NAME - (string) The name of the database on the MySQL/MariaDB server.
* DATABASE_HOST - (string) The address of the host where the MySQL/MariaDB server resides. If not supplied, defaults to 127.0.0.1 (localhost).
* DATABASE_PORT - (integer) The port used to connect to the MySQL/MariaDB server. If not supplied, defaults to 3306.
* DATABASE_USER_STAFF - (string) The username for the MySQL/MariaDB server user that is used for access via the staff web pages. 
* DATABASE_PASS_STAFF - (string) The password for the MySQL/MariaDB server user that is used for access via the staff web pages.
* DATABASE_USER_MOBILE - (string) The username for the MySQL/MariaDB server user that is used for access via the mobile app.
* DATABASE_PASS_MOBILE - (string) The password for the MySQL/MariaDB server user that is used for access via the mobile app.
* COOKIE_SECRET_KEY - (string) A string to use as the secret key for generating session cookies.
* PORT - (integer) The network port used for incoming and outgoing connections from the server. If not supplied, defaults to 3000.
* LOGIN_EXPIRE_TIME - (integer) The number of seconds that a user's login should remain valid for, before the user must log in again. If not supplied, defaults to 86400 (one day).
* USE_HTTPS - (true/false) Whether to use HTTPS when starting the server. A valid certificate and secret key is required in order to use HTTPS.
* HTTPS_KEY_LOCATION - (string) A path to the .pem file containing the secret key for the server certificate. If not supplied, defaults to "key.pem" (in the server's root directory). Is not required if not using HTTPS.
* HTTPS_CERT_LOCATION - (string) A path to the .pem file containing the certificate data for the server certificate. If not supplied, defaults to "cert.pem" (in the server's root directory). Is not required if not using HTTPS.
* DEBUG - (true/false) Whether to print debug statements to the console; for use when testing. If not supplied, defaults to false.

This server uses an npm package to create a service that starts on boot for both Windows and Linux. To create it, run the command `npm start -- --add` in the server's root directory. You can also remove the service later by using `npm start -- --remove'.

Once the service has been added, it will start on next boot. It can also be started or stopped manually through the following methods:

For Windows:
1. Open the Services application with Administrator privileges.
1. Find the "Yarrabilba SSC Mobile App Server (node.js)" entry in the list, and right-click it.
l. To start the servce, select "Start".
l. To stop the service, select "Stop".

For Linux:
1. Open a Terminal window with root privileges.
1. Depending on your system configuration, the service can be started with one of the following commands:
    - `service Example_Mobile_App_Server start`
    - `systemctl start Example_Mobile_App_Server`
1. The service can also be stopped using the corresponding command below:
    - `service Example_Mobile_App_Server stop`
    - `systemctl stop Example_Mobile_App_Server`
    
If the package cannot create a service on Linux, follow the instructions below to create it manually (instructions for Windows may come at a later date):
1. Create a Example_Mobile_App_Server.service file in the /etc/systemd/system folder. It should have similar contents to below, replacing "/path" with the path to the server's root directory. For example, if you have the server in "/home/admin/Example_Mobile_App_Server", that would replace "/path". "Restart=always" indicates that the service will attempt to restart if it closes for any reason.
```
[Unit]
Description=Example Mobile App Server (node.js)
[Service]
ExecStart=node /path/bin/www --run
Restart=always
User=nobody
Group=nogroup #Use 'nobody' if on Red Hat or Fedora
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/path
[Install]
WantedBy=multi-user.target
```
1. After the file is created, start the service with the command `service Example_Mobile_App_Server start` or `systemctl start Example_Mobile_App_Server` depending on your system configuration. You can also run `systemctl enable Example_Mobile_App_Server` to have the server start on boot.

## Sensors

This server is designed to work with a custom designed sensor that has been developed by [Substation33](https://substation33.com.au/). This sensor is placed in a compost heap and returns readings on the humidity, temperature in the sensor and in the compost, and the current methane levels, which allows the compost conditions to be monitored.

The sensor transmits data via mobile Internet to [Thingsboard](https://thingsboard.io/) at a certain interval, which consists of the following known attributes:
- mv: The voltage from the methane sensor. The actual value of methane in PPM is `(mv - 2 / 5) * 1000`.
- mvmin: The minimum voltage from the methane sensor since the last reading.
- mvmax: The maximum voltage from the methane sensor since the last reading.
- st: The temperature at the probe of the methane sensor itself.
- et: The temperature outside the sensor's enclosure.
- h: The humidity of the air oustide of the sensor (from the same location as the external temperature probe).
- v: The voltage of the sensor's battery.
- s: The voltage from the solar panels.
There is also a timestamp associated with each data transmission from the sensor, represented as a Unix Epoch.

Thingsboard provides an [API](https://thingsboard.io/docs/api/) for connecting to any devices that send data to their servers. This server communciates through the Thingsboard API, first to receive authentication credentials (a username and password belonging to an account that the sensor is associated with is required) and then to connect to a websocket associated with the sensor itself. When this server receives a message from the websocket connection, and verifies that it contains data that includes all of the above attributes, it inserts it into a new row in the database.

Currently, this server does not automatically get the sensor's IDs from Thingsboard. Instead, the administrator must have it on hand (by, for example, getting it from Substation33 or whoever manufactured the sensor) or log into the Thingsboard control panel to retrieve it. They can then go to the sensors page on the server and use the form to add the sensor to the database. If the ID is valid, this server should then start storing data from the sensor.
    
## License and copyright

This code is released under the MIT Licence. You may use this code either as is or build upon it for any purpose, even for commercial use. The only condition is that a copy of the LICENCE file, which includes the declaration of copyright, is included in any copies or derivations of the source code.

The copyright of this code belongs to the Queensland University of Technology, 2021.