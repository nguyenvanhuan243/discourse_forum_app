CREATE TABLE schema_migrations
(
    path       TEXT     NOT NULL PRIMARY KEY,
    created_at DATETIME NOT NULL,
    sql_hash   TEXT     NOT NULL
);
