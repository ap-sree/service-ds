-- =============================================
-- MASTER DATA SCRIPT (Run as Admin/SA)
-- Inserts initial required data for the application.
-- =============================================

USE ServiceDashboard;
GO

-- 1. App Configs
-- 'global_dashboard_layout' is used by AppConfigService
IF NOT EXISTS (SELECT 1
FROM app.app_configs
WHERE [key] = 'global_dashboard_layout')
BEGIN
    PRINT 'Inserting default global_dashboard_layout...';
    INSERT INTO app.app_configs
        ([key], [value])
    VALUES
        ('global_dashboard_layout', '{"widgets": [], "layout": "grid"}');
END
GO

-- 2. Users
-- Default Admin User
IF NOT EXISTS (SELECT 1
FROM app.users
WHERE username = 'admin')
BEGIN
    PRINT 'Inserting admin user...';
    INSERT INTO app.users
        (username, role, preferences)
    VALUES
        ('admin', 'ADMIN', '{"theme": "dark"}');
END

-- Default Standard User
IF NOT EXISTS (SELECT 1
FROM app.users
WHERE username = 'user')
BEGIN
    PRINT 'Inserting standard user...';
    INSERT INTO app.users
        (username, role, preferences)
    VALUES
        ('user', 'USER', '{"theme": "light"}');
END
GO

-- 3. K8s Config
-- Default to FILE type. Update 'value' to your kubeconfig path.
IF NOT EXISTS (SELECT 1
FROM app.app_configs
WHERE [key] = 'k8s_config_type')
BEGIN
    PRINT 'Inserting default k8s_config_type...';
    INSERT INTO app.app_configs
        ([key], [value])
    VALUES
        ('k8s_config_type', 'FILE');
END

IF NOT EXISTS (SELECT 1
FROM app.app_configs
WHERE [key] = 'k8s_config_value')
BEGIN
    PRINT 'Inserting default k8s_config_value (placeholder)...';
    -- Placeholder path. Please update this in the database!
    INSERT INTO app.app_configs
        ([key], [value])
    VALUES
        ('k8s_config_value', 'C:\Users\YourUser\.kube\config');
END
GO

PRINT 'Master data insertion complete.';
