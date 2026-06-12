-- =============================================
-- PART 1: Environment Setup (Run as Admin/SA)
-- =============================================

-- 1. Create Database
IF NOT EXISTS (SELECT *
FROM sys.databases
WHERE name = 'ServiceDashboard')
BEGIN
    CREATE DATABASE ServiceDashboard;
END
GO

USE ServiceDashboard;
GO

-- 2. Create Login (Server Level)
-- Change 'YourStrongPassword123' to a real secure password!
IF NOT EXISTS (SELECT *
FROM sys.server_principals
WHERE name = 'svc_dashboard_user')
BEGIN
    CREATE LOGIN svc_dashboard_user WITH PASSWORD = 'apldj29ja9h@iqwjakjsda', CHECK_POLICY = ON;
END
GO

-- 3. Create User (Database Level)
IF NOT EXISTS (SELECT *
FROM sys.database_principals
WHERE name = 'svc_dashboard_user')
BEGIN
    CREATE USER svc_dashboard_user FOR LOGIN svc_dashboard_user;
END
GO

-- 4. Create Schema
IF NOT EXISTS (SELECT *
FROM sys.schemas
WHERE name = 'app')
BEGIN
    EXEC('CREATE SCHEMA app');
END
GO

-- 5. Set Default Schema for User
ALTER USER svc_dashboard_user WITH DEFAULT_SCHEMA = app;
GO

-- 6. Grant Permissions
-- Allow user to CRUD data in 'app' schema
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA :: app TO svc_dashboard_user;
-- Allow user to Execute Stored Procedures (for DDL)
GRANT EXECUTE TO svc_dashboard_user;
GO

-- =============================================
-- PART 2: Schema Objects (Tables & SPs)
-- =============================================

-- Drop tables if they exist (clean slate approach)
IF OBJECT_ID(N'app.notification_rules', N'U') IS NOT NULL DROP TABLE app.notification_rules;
IF OBJECT_ID(N'app.widget_definitions', N'U') IS NOT NULL DROP TABLE app.widget_definitions;
IF OBJECT_ID(N'app.sync_definitions', N'U') IS NOT NULL DROP TABLE app.sync_definitions;
IF OBJECT_ID(N'app.task_executions', N'U') IS NOT NULL DROP TABLE app.task_executions;
IF OBJECT_ID(N'app.task_definitions', N'U') IS NOT NULL DROP TABLE app.task_definitions;
IF OBJECT_ID(N'app.data_sources', N'U') IS NOT NULL DROP TABLE app.data_sources;
IF OBJECT_ID(N'app.app_configs', N'U') IS NOT NULL DROP TABLE app.app_configs;
IF OBJECT_ID(N'app.users', N'U') IS NOT NULL DROP TABLE app.users;

-- Users Table
CREATE TABLE app.users
(
    username VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    preferences NVARCHAR(MAX),
    PRIMARY KEY (username)
);

-- App Configs Table
CREATE TABLE app.app_configs
(
    [key] VARCHAR(255) NOT NULL,
    [value] VARCHAR(4000),
    PRIMARY KEY ([key])
);

-- Data Sources Table
CREATE TABLE app.data_sources
(
    id BIGINT IDENTITY(1,1) NOT NULL,
    config NVARCHAR(MAX) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(255) NOT NULL,
    PRIMARY KEY (id)
);

-- Task Definitions Table
CREATE TABLE app.task_definitions
(
    id BIGINT IDENTITY(1,1) NOT NULL,
    last_run_at DATETIME2,
    last_status VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    payload NVARCHAR(MAX),
    source_id BIGINT NOT NULL,
    PRIMARY KEY (id)
);

-- Task Executions Table
CREATE TABLE app.task_executions
(
    id BIGINT IDENTITY(1,1) NOT NULL,
    completed_at DATETIME2,
    input_payload NVARCHAR(MAX),
    output_result NVARCHAR(MAX),
    started_at DATETIME2 NOT NULL,
    status VARCHAR(255) NOT NULL,
    task_id BIGINT NOT NULL,
    task_type VARCHAR(50) NOT NULL DEFAULT 'TASK',
    triggered_by VARCHAR(255),
    PRIMARY KEY (id)
);

-- Sync Definitions Table
CREATE TABLE app.sync_definitions
(
    id BIGINT IDENTITY(1,1) NOT NULL,
    fetch_query NVARCHAR(MAX) NOT NULL,
    field_mapping NVARCHAR(MAX),
    http_method VARCHAR(255),
    last_run_at DATETIME2,
    last_status VARCHAR(255),
    pagination_config NVARCHAR(MAX),
    primary_key VARCHAR(255),
    request_body NVARCHAR(MAX),
    schedule_config VARCHAR(255),
    source_id BIGINT NOT NULL,
    sync_mode VARCHAR(255) NOT NULL,
    sync_strategy VARCHAR(255) NOT NULL,
    target_table_name VARCHAR(255) NOT NULL,
    root_path VARCHAR(500),
    schema_changed BIT DEFAULT 0,
    PRIMARY KEY (id)
);

-- Widget Definitions Table
CREATE TABLE app.widget_definitions
(
    id BIGINT IDENTITY(1,1) NOT NULL,
    data_source_table VARCHAR(255) NOT NULL,
    query_config NVARCHAR(MAX),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    user_column VARCHAR(255),
    sync_id BIGINT,
    schema_changed BIT DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT FK_widget_sync FOREIGN KEY (sync_id) REFERENCES app.sync_definitions (id)
);

-- Notification Rules Table
CREATE TABLE app.notification_rules
(
    id BIGINT IDENTITY(1,1) NOT NULL,
    action_type VARCHAR(255) NOT NULL,
    condition_json NVARCHAR(MAX) NOT NULL,
    local_table_name VARCHAR(255) NOT NULL,
    message_template VARCHAR(255) NOT NULL,
    schedule_config VARCHAR(255),
    schedule_type VARCHAR(255),
    target_role VARCHAR(255),
    title_template VARCHAR(255) NOT NULL,
    user_column VARCHAR(255),
    sync_id BIGINT,
    schema_changed BIT DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT FK_notification_sync FOREIGN KEY (sync_id) REFERENCES app.sync_definitions (id)
);

-- Stored Procedures for Dynamic Table Management
-- Access to DDL is encapsulated here.
-- 'WITH EXECUTE AS OWNER' ensures the procedure runs with the permissions of the creator (dbo),
-- bypassing the caller's lack of DDL permissions for Dynamic SQL.

GO

CREATE OR ALTER PROCEDURE app.sp_CreateDynamicTable
    @TableName NVARCHAR(128),
    @ColumnDefinitions NVARCHAR(MAX)
WITH
    EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    -- Basic SQL Injection Prevention: Validate Table Name characters
    -- (This simple check assumes table names are alphanumeric/underscores only from the service)
    IF @TableName LIKE '%[^a-zA-Z0-9_]%'
    BEGIN
        RAISERROR('Invalid table name', 16, 1);
        RETURN;
    END

    DECLARE @SQL NVARCHAR(MAX);

    -- Check if table exists in 'app' schema
    IF OBJECT_ID('app.' + @TableName, 'U') IS NULL
    BEGIN
        -- Construct CREATE TABLE Statement inside 'app' schema
        -- Note: The service sends just the list of custom columns. 
        -- We add the standard ID and metadata columns here to ensure consistency and security.
        SET @SQL = 'CREATE TABLE app.' + QUOTENAME(@TableName) + ' (
            _id INT IDENTITY(1,1) PRIMARY KEY,
            _synced_at DATETIME2 DEFAULT SYSUTCDATETIME()';

        IF LEN(@ColumnDefinitions) > 0
        BEGIN
            SET @SQL = @SQL + ', ' + @ColumnDefinitions;
        END

        SET @SQL = @SQL + ');';

        EXEC sp_executesql @SQL;
    END
END

GO

CREATE OR ALTER PROCEDURE app.sp_DropDynamicTable
    @TableName NVARCHAR(128)
WITH
    EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    IF @TableName LIKE '%[^a-zA-Z0-9_]%'
    BEGIN
        RAISERROR('Invalid table name', 16, 1);
        RETURN;
    END

    DECLARE @SQL NVARCHAR(MAX);
    IF OBJECT_ID('app.' + @TableName, 'U') IS NOT NULL
    BEGIN
        SET @SQL = 'DROP TABLE app.' + QUOTENAME(@TableName);
        EXEC sp_executesql @SQL;
    END
END

GO

CREATE OR ALTER PROCEDURE app.sp_CheckTableExists
    @TableName NVARCHAR(128)
WITH
    EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'app' AND TABLE_NAME = @TableName)
    BEGIN
        SELECT 1;
    END
    ELSE
    BEGIN
        SELECT 0;
    END
END

GO

CREATE OR ALTER PROCEDURE app.sp_GetTableColumns
    @TableName NVARCHAR(128)
WITH
    EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    IF @TableName LIKE '%[^a-zA-Z0-9_]%'
    BEGIN
        RAISERROR('Invalid table name', 16, 1);
        RETURN;
    END

    SELECT COLUMN_NAME as [name]
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'app' AND TABLE_NAME = @TableName
    ORDER BY ORDINAL_POSITION;
END
