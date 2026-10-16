-- Hosted MySQL version (Aiven / TiDB Cloud): run inside the database the provider gives you.
-- No DROP/CREATE DATABASE. To reset, drop the four tables first.
SET time_zone = '+05:30';
DROP TABLE IF EXISTS bookings, slots, parking_locations, users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE parking_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  price_per_hour DECIMAL(8,2) NOT NULL DEFAULT 20.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id INT NOT NULL,
  slot_number VARCHAR(10) NOT NULL,
  vehicle_type ENUM('car','bike') NOT NULL DEFAULT 'car',
  is_active TINYINT(1) NOT NULL DEFAULT 1,   -- admin can disable a slot
  UNIQUE KEY uq_slot (location_id, slot_number),
  FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  slot_id INT NOT NULL,
  vehicle_number VARCHAR(20) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  amount DECIMAL(8,2) NOT NULL DEFAULT 0,
  status ENUM('booked','cancelled','entered','completed') NOT NULL DEFAULT 'booked',
  payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  payment_ref VARCHAR(100),
  qr_token VARCHAR(64) UNIQUE,
  exit_otp_hash VARCHAR(255),
  otp_expires_at DATETIME,
  entry_time DATETIME,
  exit_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE,
  INDEX idx_slot_time (slot_id, start_time, end_time),
  CHECK (end_time > start_time)
);
-- Overlap check (in PHP): a slot is taken if a row exists with
-- slot_id = ? AND status IN ('booked','entered') AND start_time < :new_end AND end_time > :new_start

-- Seed: admin@parking.com / admin123, users / user123
INSERT INTO users (name,email,phone,password_hash,role) VALUES
('Admin','admin@parking.com','9000000000','$2b$10$Qh9FMmHCHAccZPuX8ULnQOpYL7D9UK4zWDInreNaU3Rv8z1fvl2MG','admin'),
('Rahul Patil','rahul@example.com','9000000001','$2b$10$2MIVVFhgeKBnDWBxmJG3nunDgsfdFi2Uq59T.RFX6l0cIgQ6aAVA2','user'),
('Sneha Kulkarni','sneha@example.com','9000000002','$2b$10$2MIVVFhgeKBnDWBxmJG3nunDgsfdFi2Uq59T.RFX6l0cIgQ6aAVA2','user');

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

-- Sample bookings so the map shows some red slots
INSERT INTO bookings (user_id,slot_id,vehicle_number,start_time,end_time,amount,status,payment_status,qr_token) VALUES
(2,1,'KA22AB1234',NOW() - INTERVAL 1 HOUR,NOW() + INTERVAL 2 HOUR,60.00,'booked','paid',SHA2('seed-1',256)),
(3,10,'KA22CD5678',NOW(),NOW() + INTERVAL 3 HOUR,75.00,'booked','pending',NULL);
