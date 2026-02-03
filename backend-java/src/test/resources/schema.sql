-- AppConfig Table
CREATE TABLE "app_configs" (
    "key" VARCHAR(255) PRIMARY KEY,
    "value" VARCHAR(4000)
);

-- DataSource Table
CREATE TABLE "data_sources" (
    "id" BIGINT AUTO_INCREMENT PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "config" CLOB NOT NULL
);

-- NotificationRule Table
CREATE TABLE "notification_rules" (
    "id" BIGINT AUTO_INCREMENT PRIMARY KEY,
    "local_table_name" VARCHAR(255) NOT NULL,
    "condition_json" CLOB NOT NULL,
    "action_type" VARCHAR(255) NOT NULL,
    "message_template" VARCHAR(255),
    "schedule_type" VARCHAR(255),
    "schedule_config" VARCHAR(255),
    "user_column" VARCHAR(255),
    "target_role" VARCHAR(255),
    "title_template" VARCHAR(255)
);

-- SyncDefinition Table
CREATE TABLE "sync_definitions" (
    "id" BIGINT AUTO_INCREMENT PRIMARY KEY,
    "source_id" BIGINT NOT NULL,
    "target_table_name" VARCHAR(255) NOT NULL,
    "fetch_query" CLOB NOT NULL,
    "sync_mode" VARCHAR(255) NOT NULL,
    "schedule_config" VARCHAR(255),
    "field_mapping" CLOB,
    "last_run_at" TIMESTAMP,
    "last_status" VARCHAR(255),
    "sync_strategy" VARCHAR(255),
    "primary_key" VARCHAR(255)
);

-- User Table
CREATE TABLE "users" (
    "username" VARCHAR(255) PRIMARY KEY,
    "role" VARCHAR(255),
    "preferences" CLOB
);

-- WidgetDefinition Table
CREATE TABLE "widget_definitions" (
    "id" BIGINT AUTO_INCREMENT PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "data_source_table" VARCHAR(255) NOT NULL,
    "query_config" CLOB,
    "user_column" VARCHAR(255)
);
