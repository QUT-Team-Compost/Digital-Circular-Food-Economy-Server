CREATE DATABASE IF NOT EXISTS `example` /*!40100 DEFAULT CHARACTER SET utf8 */;
USE `example`;

-- MySQL dump 10.13  Distrib 8.0.21, for Linux (x86_64)
--
-- Host: localhost    Database: example
-- ------------------------------------------------------
-- Server version	8.0.21

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `houses`
--

DROP TABLE IF EXISTS `houses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `houses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  `score` decimal(20,0) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`,`name`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Data for table `houses`
--

LOCK TABLES `houses` WRITE;
/*!40000 ALTER TABLE `houses` DISABLE KEYS */;
INSERT INTO `houses` VALUES (1,'House_1',0),(2,'House_1',0),(3,'House_1',0),(4,'House_1',0);
/*!40000 ALTER TABLE `houses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(64) DEFAULT NULL,
  `password` varchar(64) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '0',
  `house` int DEFAULT NULL,
  `role` varchar(11) DEFAULT NULL,
  `username` varchar(64) NOT NULL,
  PRIMARY KEY (`id`,`username`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  KEY `house_FK` (`house`),
  CONSTRAINT `house_FK` FOREIGN KEY (`house`) REFERENCES `houses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,NULL,'$2b$10$3O./fWhZqY.le3PX7eHCnugR.r9U/Efm5/tarpxUpy9yReM8ey84u',1,NULL,'admin','app_admin');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sensors`
--

DROP TABLE IF EXISTS `sensors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sensors` (
  `id` varchar(36) NOT NULL,
  `name` varchar(45) NOT NULL,
  `description` varchar(100) NOT NULL DEFAULT 'Description not available.',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Data for table `sensors`
--

LOCK TABLES `sensors` WRITE;
/*!40000 ALTER TABLE `sensors` DISABLE KEYS */;
INSERT INTO `sensors` VALUES ('d444f210-9025-11eb-b5ca-d76ebde59f16','S33/0/GAS','Carol\'s Methane Sensor');
/*!40000 ALTER TABLE `sensors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sensor_data`
--

DROP TABLE IF EXISTS `sensor_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sensor_data` (
  `sensor_id` varchar(36) NOT NULL,
  `timestamp` datetime NOT NULL,
  `mv` decimal(4,3) NOT NULL,
  `mvmin` decimal(4,3) NOT NULL,
  `mvmax` decimal(4,3) NOT NULL,
  `compensated_sensor_reading` decimal(15,14) NOT NULL,
  `st` decimal(5,2) NOT NULL,
  `et` decimal(5,2) NOT NULL,
  `t` decimal(4,1) NOT NULL,
  `h` decimal(4,1) NOT NULL,
  `v` decimal(4,3) NOT NULL,
  `s` decimal(4,3) NOT NULL,
  PRIMARY KEY (`sensor_id`,`timestamp`),
  CONSTRAINT `fk_sensor_id` FOREIGN KEY (`sensor_id`) REFERENCES `sensors` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `sensor_data_latest`
--

DROP TABLE IF EXISTS `sensor_data_latest`;
/*!50001 DROP VIEW IF EXISTS `sensor_data_latest`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `sensor_data_latest` AS SELECT 
 1 AS `id`,
 1 AS `name`,
 1 AS `description`,
 1 AS `timestamp`,
 1 AS `mv`,
 1 AS `mvmin`,
 1 AS `mvmax`,
 1 AS `compensated_sensor_reading`,
 1 AS `st`,
 1 AS `et`,
 1 AS `t`,
 1 AS `h`,
 1 AS `v`,
 1 AS `s`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `sensor_data_latest`
--

/*!50001 DROP VIEW IF EXISTS `sensor_data_latest`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8 */;
/*!50001 SET character_set_results     = utf8 */;
/*!50001 SET collation_connection      = utf8_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `sensor_data_latest` AS select `example`.`sensors`.`id` AS `id`,`example`.`sensors`.`name` AS `name`,`example`.`sensors`.`description` AS `description`,`sensor_data_max`.`timestamp` AS `timestamp`,`sensor_data_max`.`mv` AS `mv`,`sensor_data_max`.`mvmin` AS `mvmin`,`sensor_data_max`.`mvmax` AS `mvmax`,`sensor_data_max`.`compensated_sensor_reading` AS `compensated_sensor_reading`,`sensor_data_max`.`st` AS `st`,`sensor_data_max`.`et` AS `et`,`sensor_data_max`.`t` AS `t`,`sensor_data_max`.`h` AS `h`,`sensor_data_max`.`v` AS `v`,`sensor_data_max`.`s` AS `s` from (`example`.`sensors` left join (select `example`.`sensor_data`.`sensor_id` AS `sensor_id`,`example`.`sensor_data`.`timestamp` AS `timestamp`,`example`.`sensor_data`.`mv` AS `mv`,`example`.`sensor_data`.`mvmin` AS `mvmin`,`example`.`sensor_data`.`mvmax` AS `mvmax`,`example`.`sensor_data`.`compensated_sensor_reading` AS `compensated_sensor_reading`,`example`.`sensor_data`.`st` AS `st`,`example`.`sensor_data`.`et` AS `et`,`example`.`sensor_data`.`t` AS `t`,`example`.`sensor_data`.`h` AS `h`,`example`.`sensor_data`.`v` AS `v`,`example`.`sensor_data`.`s` AS `s` from `example`.`sensor_data` where `example`.`sensor_data`.`timestamp` in (select max(`example`.`sensor_data`.`timestamp`) from `example`.`sensor_data` group by `example`.`sensor_data`.`sensor_id`)) `sensor_data_max` on((`example`.`sensors`.`id` = `sensor_data_max`.`sensor_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Set up database users
-- Remember to change "password" to a real password!
CREATE USER 'mobile_app_admin'@'localhost' IDENTIFIED BY 'password';
CREATE USER 'mobile_apps'@'localhost' IDENTIFIED BY 'password';
GRANT ALL ON example.houses TO 'mobile_app_admin'@'localhost';
GRANT ALL ON example.users TO 'mobile_app_admin'@'localhost';
GRANT SELECT, UPDATE ON example.houses TO 'mobile_apps'@'localhost';
GRANT SELECT, UPDATE ON example.users TO 'mobile_apps'@'localhost';
GRANT ALL ON example.sensors TO 'mobile_app_admin'@'localhost';
GRANT ALL ON example.sensor_data TO 'mobile_app_admin'@'localhost';
GRANT ALL ON example.sensor_data_latest TO 'mobile_app_admin'@'localhost';
GRANT SELECT ON example.sensors TO 'mobile_apps'@'localhost';
GRANT SELECT ON example.sensor_data TO 'mobile_apps'@'localhost';
GRANT SELECT ON example.sensor_data_latest TO 'mobile_apps'@'localhost';
FLUSH PRIVILEGES;