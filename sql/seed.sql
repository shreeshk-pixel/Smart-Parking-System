-- Demo data (v2). The app runs this only when the users table is empty.
-- seed_demo_v3.sql runs right after it and sets the real passwords (documented privately, not in this repo).
INSERT INTO users (name,email,phone,password_hash,role) VALUES
('Admin','admin@parking.com','9000000000','$2a$10$PQS.zOY51K8yV.oJMz4VauV7xDFpgKMYCaqvHqnwZfGlt3LiZ9JsW','admin'),
('Rahul Patil','rahul@example.com','9000000001','$2a$10$Qyo7uLH8p02DMy91ATBK6OtcOFXhF9Dnnrxv8cN2q7jL6DW.xC2uC','user'),
('Sneha Kulkarni','sneha@example.com','9000000002','$2a$10$Qyo7uLH8p02DMy91ATBK6OtcOFXhF9Dnnrxv8cN2q7jL6DW.xC2uC','user'),
('Arjun Desai','arjun@example.com','9000000003','$2a$10$Qyo7uLH8p02DMy91ATBK6OtcOFXhF9Dnnrxv8cN2q7jL6DW.xC2uC','user');

INSERT INTO parking_locations (name,address,latitude,longitude,price_per_hour) VALUES
('Central Bus Stand Parking','CBT, Belagavi',15.8650,74.5120,20.00),
('Belagavi Railway Station Parking','Station Road, Belagavi',15.8527,74.5030,25.00),
('KLS GIT Campus Parking','Udyambag, Belagavi',15.8195,74.4880,10.00),
('Khade Bazar Parking','Khade Bazar, Belagavi',15.8600,74.5160,30.00);

-- Every lot has all five floors. Per floor: CBT 6 bikes + 4 cars, Railway 8 + 5, KLS GIT 6 + 3, Khade Bazar 6 + 4 (210 slots)
INSERT INTO slots (location_id, floor, vehicle_type, slot_no)
SELECT l.id, f.floor, t.vt, n
  FROM (VALUES ('Central Bus Stand Parking', 6, 4), ('Belagavi Railway Station Parking', 8, 5),
               ('KLS GIT Campus Parking', 6, 3), ('Khade Bazar Parking', 6, 4)) AS c(name, bikes, cars)
  JOIN parking_locations l ON l.name = c.name
 CROSS JOIN (VALUES ('LG', 1), ('G', 2), ('F1', 3), ('F2', 4), ('F3', 5)) AS f(floor, ord)
 CROSS JOIN (VALUES ('B'), ('C')) AS t(vt)
 CROSS JOIN LATERAL generate_series(1, CASE WHEN t.vt = 'B' THEN c.bikes ELSE c.cars END) AS n
 ORDER BY l.id, f.ord, t.vt, n;

-- Sample bookings: a few active now (taken slots on the map), one tomorrow, and two weeks of history for the admin report
INSERT INTO bookings (user_id, slot_id, vehicle_number, start_time, end_time, amount, status, payment_status, payment_ref,
                      paid_at, qr_token, entry_time, exit_time, created_at)
SELECT u.id, s.id, v.veh, v.st, v.st + v.hrs * interval '1 hour', v.amt, v.status, v.pay, v.ref,
       CASE WHEN v.pay = 'paid' THEN LEAST(v.st - interval '110 minutes', NOW()) END,
       md5('seed-' || v.n),
       CASE WHEN v.status IN ('entered', 'completed') THEN v.st + interval '5 minutes' END,
       CASE WHEN v.status = 'completed' THEN v.st + v.hrs * interval '1 hour' - interval '10 minutes' END,
       LEAST(v.st - interval '2 hours', NOW())
  FROM (VALUES
    (1,  'rahul@example.com', 'Central Bus Stand Parking',        'G',  'C', 1, 'KA22AB1234', (NOW() - interval '1 hour')::timestamptz,              3,  60, 'booked',    'paid',    'MOCKSEED0001'),
    (2,  'sneha@example.com', 'Belagavi Railway Station Parking', 'F1', 'C', 2, 'KA22CD5678', NOW()::timestamptz,                                    3,  75, 'booked',    'pending', NULL),
    (3,  'arjun@example.com', 'Central Bus Stand Parking',        'LG', 'B', 2, 'KA22EJ4321', (NOW() - interval '30 minutes')::timestamptz,          2,  40, 'entered',   'paid',    'MOCKSEED0003'),
    (4,  'sneha@example.com', 'Khade Bazar Parking',              'F1', 'C', 4, 'KA22CD5678', ((CURRENT_DATE + 1) + time '10:00')::timestamptz,      2,  60, 'booked',    'paid',    'MOCKSEED0004'),
    (5,  'rahul@example.com', 'KLS GIT Campus Parking',           'G',  'B', 2, 'KA22EF1111', ((CURRENT_DATE - 1) + time '09:00')::timestamptz,      6,  60, 'completed', 'paid',    'MOCKSEED0005'),
    (6,  'rahul@example.com', 'Belagavi Railway Station Parking', 'LG', 'B', 3, 'KA22EF1111', ((CURRENT_DATE - 2) + time '10:00')::timestamptz,      2,  50, 'completed', 'paid',    'MOCKSEED0006'),
    (7,  'sneha@example.com', 'Central Bus Stand Parking',        'F1', 'B', 5, 'KA22GH2222', ((CURRENT_DATE - 3) + time '11:00')::timestamptz,      4,  80, 'completed', 'paid',    'MOCKSEED0007'),
    (8,  'sneha@example.com', 'Belagavi Railway Station Parking', 'F2', 'C', 5, 'KA22CD5678', ((CURRENT_DATE - 4) + time '15:00')::timestamptz,      3,  75, 'cancelled', 'pending', NULL),
    (9,  'rahul@example.com', 'Khade Bazar Parking',              'G',  'C', 2, 'KA22AB1234', ((CURRENT_DATE - 5) + time '17:00')::timestamptz,      2,  60, 'completed', 'paid',    'MOCKSEED0009'),
    (10, 'arjun@example.com', 'Belagavi Railway Station Parking', 'F3', 'C', 1, 'KA22EJ4321', ((CURRENT_DATE - 5) + time '09:00')::timestamptz,      8, 200, 'completed', 'paid',    'MOCKSEED0010'),
    (11, 'sneha@example.com', 'KLS GIT Campus Parking',           'F2', 'C', 1, 'KA22CD5678', ((CURRENT_DATE - 6) + time '12:00')::timestamptz,      1,  10, 'cancelled', 'pending', NULL),
    (12, 'rahul@example.com', 'Khade Bazar Parking',              'F3', 'B', 1, 'KA22EF1111', ((CURRENT_DATE - 8) + time '14:00')::timestamptz,      3,  90, 'completed', 'paid',    'MOCKSEED0012'),
    (13, 'arjun@example.com', 'Central Bus Stand Parking',        'G',  'C', 3, 'KA22EJ4321', ((CURRENT_DATE - 9) + time '08:00')::timestamptz,      4,  80, 'completed', 'paid',    'MOCKSEED0013'),
    (14, 'sneha@example.com', 'Belagavi Railway Station Parking', 'G',  'B', 4, 'KA22GH2222', ((CURRENT_DATE - 10) + time '10:00')::timestamptz,     5, 125, 'completed', 'paid',    'MOCKSEED0014'),
    (15, 'rahul@example.com', 'Central Bus Stand Parking',        'LG', 'C', 3, 'KA22AB1234', ((CURRENT_DATE - 12) + time '18:00')::timestamptz,     2,  40, 'completed', 'paid',    'MOCKSEED0015'),
    (16, 'arjun@example.com', 'KLS GIT Campus Parking',           'F1', 'B', 6, 'KA22EJ4321', ((CURRENT_DATE - 14) + time '09:00')::timestamptz,     3,  30, 'completed', 'paid',    'MOCKSEED0016')
  ) AS v(n, email, loc, fl, vt, no, veh, st, hrs, amt, status, pay, ref)
  JOIN users u ON u.email = v.email
  JOIN parking_locations l ON l.name = v.loc
  JOIN slots s ON s.location_id = l.id AND s.floor = v.fl AND s.vehicle_type = v.vt AND s.slot_no = v.no
 ORDER BY v.n;
