#!/bin/bash
yum install -y curl
curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -
yum install -y nodejs
yum install -y mysql-server
systemctl start mysqld
systemctl enable mysqld
#yum install -y redis
#systemctl start redis
#systemctl enable redis
yum install gcc-c++
yum install make
npm install
mysql < ./SQL/database.sql