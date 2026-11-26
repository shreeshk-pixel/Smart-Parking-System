-- LOCAL TESTING ONLY: wipes everything. Run this, then schema.sql, migrate_v2_floors.sql and seed.sql.
DROP TABLE IF EXISTS bookings, slots, parking_locations, users, app_meta, slots_v1_backup, bookings_v1_backup;
