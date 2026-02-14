-- =============================================
-- CLEANUP SCRIPT (Run as Admin/SA)
-- USE WITH CAUTION: This will DELETE the entire database!
-- =============================================

-- USE master;
-- GO

-- -- 1. Kick off all users and Drop Database
-- IF EXISTS (SELECT *
-- FROM sys.databases
-- WHERE name = 'ServiceDashboard')
-- BEGIN
--     ALTER DATABASE ServiceDashboard SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
--     DROP DATABASE ServiceDashboard;
-- END
-- GO

-- -- 2. Drop Login
-- IF EXISTS (SELECT *
-- FROM sys.server_principals
-- WHERE name = 'svc_dashboard_user')
-- BEGIN
--     DROP LOGIN svc_dashboard_user;
-- END
-- GO

-- =============================================
-- OPTION 2: CLEAR SCHEMA OBJECTS ONLY (Keep DB & User)
-- Run this section if you just want to reset tables/SPs but keep the DB/User.
-- =============================================

-- USE ServiceDashboard;
-- GO

DECLARE @Sql NVARCHAR(MAX) = N'';

-- Drop Foreign Keys
SELECT @Sql += 'ALTER TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';' + CHAR(13)
FROM sys.foreign_keys AS fk
    INNER JOIN sys.tables AS t ON fk.parent_object_id = t.object_id
    INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
WHERE s.name = 'app';

-- Drop Tables
SELECT @Sql += 'DROP TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ';' + CHAR(13)
FROM sys.tables AS t
    INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
WHERE s.name = 'app';

-- Drop Stored Procedures
SELECT @Sql += 'DROP PROCEDURE ' + QUOTENAME(s.name) + '.' + QUOTENAME(p.name) + ';' + CHAR(13)
FROM sys.procedures AS p
    INNER JOIN sys.schemas AS s ON p.schema_id = s.schema_id
WHERE s.name = 'app';

EXEC sp_executesql @Sql;
GO
