#!/bin/bash
yum install -y curl
curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -
yum install -y nodejs
yum install -y mysql-server
systemctl start mysqld
systemctl enable mysqld
yum install -y gcc-c++
yum install -y make
npm ci
mysql < ./SQL/database.sql