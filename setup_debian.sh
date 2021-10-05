#!/bin/bash
apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt-get install -y nodejs
apt-get install -y npm
apt-get install -y mariadb-server
systemctl start mysqld
systemctl enable mysqld
#apt-get install -y redis
#systemctl start redis
#systemctl enable redis
apt-get install -y g++
apt-get install make
npm install
mysql < ./SQL/database.sql