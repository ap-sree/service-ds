USE ServiceDashboard;
GO

CREATE OR ALTER PROCEDURE app.sp_CreateDynamicTable
    @TableName NVARCHAR(128),
    @ColumnDefinitions NVARCHAR(MAX)
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

    IF OBJECT_ID('app.' + @TableName, 'U') IS NULL
    BEGIN
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
