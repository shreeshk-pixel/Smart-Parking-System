-- Demo data. Run only when the users table is empty.
-- Seed: admin@parking.com / admin123, rahul@example.com and sneha@example.com / user123
INSERT INTO users (name,email,phone,password_hash,role) VALUES
('Admin','admin@parking.com','9000000000','$2a$10$PQS.zOY51K8yV.oJMz4VauV7xDFpgKMYCaqvHqnwZfGlt3LiZ9JsW','admin'),
('Rahul Patil','rahul@example.com','9000000001','$2a$10$Qyo7uLH8p02DMy91ATBK6OtcOFXhF9Dnnrxv8cN2q7jL6DW.xC2uC','user'),
('Sneha Kulkarni','sneha@example.com','9000000002','$2a$10$Qyo7uLH8p02DMy91ATBK6OtcOFXhF9Dnnrxv8cN2q7jL6DW.xC2uC','user');

INSERT INTO parking_locations (name,address,latitude,longitude,price_per_hour) VALUES
('Central Bus Stand Parking','CBT, Belagavi',15.8650,74.5120,20.00),
('Belagavi Railway Station Parking','Station Road, Belagavi',15.8527,74.5030,25.00),
('KLS GIT Campus Parking','Udyambag, Belagavi',15.8195,74.4880,10.00),
('Khade Bazar Parking','Khade Bazar, Belagavi',15.8600,74.5160,30.00);

INSERT INTO slots (location_id,slot_number,vehicle_type) VALUES
(1,'A1','car'),(1,'A2','car'),(1,'A3','car'),(1,'A4','car'),(1,'B1','bike'),(1,'B2','bike'),(1,'B3','bike'),(1,'B4','bike'),
(2,'A1','car'),(2,'A2','car'),(2,'A3','car'),(2,'A4','car'),(2,'A5','car'),(2,'B1','bike'),(2,'B2','bike'),(2,'B3','bike'),(2,'B4','bike'),(2,'B5','bike'),
(3,'A1','car'),(3,'A2','car'),(3,'A3','car'),(3,'B1','bike'),(3,'B2','bike'),(3,'B3','bike'),
(4,'A1','car'),(4,'A2','car'),(4,'A3','car'),(4,'A4','car'),(4,'B1','bike'),(4,'B2','bike'),(4,'B3','bike'),(4,'B4','bike'),(4,'B5','bike'),(4,'B6','bike');

-- Sample bookings (relative to setup time) so the map shows some taken slots
INSERT INTO bookings (user_id,slot_id,vehicle_number,start_time,end_time,amount,status,payment_status,qr_token) VALUES
(2,1,'KA22AB1234',NOW() - INTERVAL '1 hour',NOW() + INTERVAL '2 hours',60.00,'booked','paid',md5('seed-1')),
(3,10,'KA22CD5678',NOW(),NOW() + INTERVAL '3 hours',75.00,'booked','pending',NULL);
