-- =====================================================================
--  06_seed.sql  -  Sample data (DML: INSERT / CALL / UPDATE)
--  Dates are relative to CURDATE() so the data always looks recent.
--  Every seeded account uses the demo password  Password@123
--  (stored only as a bcrypt hash).
-- =====================================================================
USE campus_lostfound;

SET @app_user_id = NULL;
SET @pw = '$2b$10$m0PwaeashnlFkC/x0LgG6OWZ447t0/ALqHVBdqe4euqzhW7cOW8s2';

-- ------------------------------------------------------------ RBAC
INSERT INTO roles (role_id, role_name, description) VALUES
  (1, 'STUDENT', 'Students: report lost/found items, search, and claim items'),
  (2, 'STAFF',   'Lost & Found desk / security staff: verify claims and record hand-overs'),
  (3, 'ADMIN',   'Administrators: manage users, roles, master data and the vector database');

INSERT INTO permissions (permission_id, permission_code, description) VALUES
  (1,  'REPORT_LOST',         'Report a lost item'),
  (2,  'REPORT_FOUND',        'Report a found item'),
  (3,  'CLAIM_SUBMIT',        'Submit an ownership claim for a found item'),
  (4,  'VIEW_HIDDEN_DETAILS', 'See hidden identifying marks and finder contact details'),
  (5,  'CLAIM_VERIFY',        'Approve or reject ownership claims'),
  (6,  'RETURN_RECORD',       'Record the hand-over of an item to its owner'),
  (7,  'MATCH_MANAGE',        'Run matching for any report and dismiss suggestions'),
  (8,  'REPORTS_VIEW',        'View analytics and reports'),
  (9,  'SQL_LAB_VIEW',        'Run the predefined showcase SQL queries'),
  (10, 'MASTER_DATA_MANAGE',  'Manage categories and campus locations'),
  (11, 'USER_MANAGE',         'Change user roles and activate or deactivate accounts'),
  (12, 'ITEM_DISPOSE',        'Dispose of items that stayed unclaimed for a long time'),
  (13, 'VECTOR_DB_MANAGE',    'Inspect, update and delete vector database records'),
  (14, 'AUDIT_VIEW',          'View the audit log'),
  (15, 'RBAC_MANAGE',         'Grant or revoke permissions of roles');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, permission_id FROM permissions WHERE permission_code IN ('REPORT_LOST', 'REPORT_FOUND', 'CLAIM_SUBMIT');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, permission_id FROM permissions
WHERE permission_code IN ('REPORT_LOST', 'REPORT_FOUND', 'CLAIM_SUBMIT', 'VIEW_HIDDEN_DETAILS', 'CLAIM_VERIFY',
                          'RETURN_RECORD', 'MATCH_MANAGE', 'REPORTS_VIEW', 'SQL_LAB_VIEW');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, permission_id FROM permissions;

-- ------------------------------------------------------------ departments & users
INSERT INTO departments (dept_id, dept_code, dept_name) VALUES
  (1, 'AM', 'Computer Science and Engineering (AI & ML)'),
  (2, 'CS', 'Computer Science and Engineering'),
  (3, 'EC', 'Electronics and Communication Engineering'),
  (4, 'EE', 'Electrical and Electronics Engineering'),
  (5, 'ME', 'Mechanical Engineering'),
  (6, 'BT', 'Biotechnology');

INSERT INTO users (user_id, full_name, email, phone, password_hash, role_id, created_at) VALUES
  (1,  'Dr. Kavitha Rao',              'admin@pes.edu',      '9845000001', @pw, 3, NOW() - INTERVAL 200 DAY),
  (2,  'Ramesh Kumar',                 'security@pes.edu',   '9845000002', @pw, 2, NOW() - INTERVAL 200 DAY),
  (3,  'Lakshmi Narayan',              'staff@pes.edu',      '9845000003', @pw, 2, NOW() - INTERVAL 200 DAY),
  (4,  'Nagalapuram Sai Mukesh Reddy', 'mukesh@pes.edu',     '9900000004', @pw, 1, NOW() - INTERVAL 180 DAY),
  (5,  'Marreddy Rushieswar Reddy',    'rushieswar@pes.edu', '9900000005', @pw, 1, NOW() - INTERVAL 180 DAY),
  (6,  'Ananya Sharma',                'ananya@pes.edu',     '9900000006', @pw, 1, NOW() - INTERVAL 170 DAY),
  (7,  'Rohan Mehta',                  'rohan@pes.edu',      '9900000007', @pw, 1, NOW() - INTERVAL 170 DAY),
  (8,  'Priya Iyer',                   'priya@pes.edu',      '9900000008', @pw, 1, NOW() - INTERVAL 165 DAY),
  (9,  'Arjun Nair',                   'arjun@pes.edu',      '9900000009', @pw, 1, NOW() - INTERVAL 165 DAY),
  (10, 'Sneha Patil',                  'sneha@pes.edu',      '9900000010', @pw, 1, NOW() - INTERVAL 60 DAY),
  (11, 'Karthik Reddy',                'karthik@pes.edu',    '9900000011', @pw, 1, NOW() - INTERVAL 160 DAY),
  (12, 'Divya Menon',                  'divya@pes.edu',      NULL,         @pw, 1, NOW() - INTERVAL 150 DAY),
  (13, 'Aditya Kulkarni',              'aditya@pes.edu',     '9900000013', @pw, 1, NOW() - INTERVAL 150 DAY),
  (14, 'Meera Joshi',                  'meera@pes.edu',      '9900000014', @pw, 1, NOW() - INTERVAL 140 DAY),
  (15, 'Vikram Singh',                 'vikram@pes.edu',     '9900000015', @pw, 1, NOW() - INTERVAL 170 DAY),
  (16, 'Ishita Gupta',                 'ishita@pes.edu',     NULL,         @pw, 1, NOW() - INTERVAL 50 DAY),
  (17, 'Nikhil Rao',                   'nikhil@pes.edu',     '9900000017', @pw, 1, NOW() - INTERVAL 120 DAY),
  (18, 'Pooja Shetty',                 'pooja@pes.edu',      '9900000018', @pw, 1, NOW() - INTERVAL 110 DAY),
  (19, 'Sameer Khan',                  'sameer@pes.edu',     '9900000019', @pw, 1, NOW() - INTERVAL 100 DAY),
  (20, 'Kavya Srinivas',               'kavya@pes.edu',      '9900000020', @pw, 1, NOW() - INTERVAL 90 DAY);

INSERT INTO staff_profiles (user_id, employee_code, designation) VALUES
  (1, 'EMP-0001', 'Dean of Student Affairs'),
  (2, 'EMP-0142', 'Security Supervisor, Main Gate'),
  (3, 'EMP-0087', 'Lost & Found Desk Officer');

INSERT INTO student_profiles (user_id, srn, dept_id, year_of_study) VALUES
  (4,  'PES1UG24AM170', 1, 3),
  (5,  'PES1UG24AM158', 1, 3),
  (6,  'PES1UG23CS045', 2, 4),
  (7,  'PES1UG24CS112', 2, 3),
  (8,  'PES1UG25EC021', 3, 2),
  (9,  'PES1UG24ME067', 5, 3),
  (10, 'PES1UG26AM009', 1, 1),
  (11, 'PES1UG23EC088', 3, 4),
  (12, 'PES1UG25CS134', 2, 2),
  (13, 'PES1UG24EE031', 4, 3),
  (14, 'PES1UG25BT014', 6, 2),
  (15, 'PES1UG23ME102', 5, 4),
  (16, 'PES1UG26CS077', 2, 1),
  (17, 'PES1UG24AM091', 1, 3),
  (18, 'PES1UG25AM143', 1, 2),
  (19, 'PES1UG24EC056', 3, 3),
  (20, 'PES2UG24CS019', 2, 3);

-- ------------------------------------------------------------ categories (3-level hierarchy)
INSERT INTO categories (category_id, category_name, parent_category_id, is_high_value) VALUES
  (1,  'Electronics',              NULL, FALSE),
  (2,  'Mobile Phones',            1,    TRUE),
  (3,  'Laptops & Tablets',        1,    TRUE),
  (4,  'Earphones & Headphones',   1,    FALSE),
  (5,  'Wireless Earbuds',         4,    FALSE),
  (6,  'Chargers & Cables',        1,    FALSE),
  (7,  'Calculators',              1,    FALSE),
  (8,  'Smart Watches',            1,    TRUE),
  (9,  'Power Banks',              1,    FALSE),
  (10, 'USB Drives',               1,    FALSE),
  (11, 'Documents & Cards',        NULL, FALSE),
  (12, 'ID Cards',                 11,   TRUE),
  (13, 'Bank Cards',               11,   TRUE),
  (14, 'Certificates & Files',     11,   FALSE),
  (15, 'Personal Accessories',     NULL, FALSE),
  (16, 'Wallets & Purses',         15,   TRUE),
  (17, 'Watches',                  15,   FALSE),
  (18, 'Spectacles',               15,   FALSE),
  (19, 'Jewellery',                15,   TRUE),
  (20, 'Keys',                     15,   FALSE),
  (21, 'Umbrellas',                15,   FALSE),
  (22, 'Bags',                     NULL, FALSE),
  (23, 'Backpacks',                22,   FALSE),
  (24, 'Handbags',                 22,   FALSE),
  (25, 'Laptop Sleeves',           22,   FALSE),
  (26, 'Books & Stationery',       NULL, FALSE),
  (27, 'Textbooks',                26,   FALSE),
  (28, 'Notebooks & Records',      26,   FALSE),
  (29, 'Pens & Stationery',        26,   FALSE),
  (30, 'Clothing',                 NULL, FALSE),
  (31, 'Jackets & Hoodies',        30,   FALSE),
  (32, 'Caps',                     30,   FALSE),
  (33, 'Sports Equipment',         NULL, FALSE),
  (34, 'Bats & Rackets',           33,   FALSE),
  (35, 'Balls',                    33,   FALSE),
  (36, 'Bottles & Lunch Boxes',    NULL, FALSE),
  (37, 'Others',                   NULL, FALSE);

-- ------------------------------------------------------------ campus locations
INSERT INTO buildings (building_id, building_name, zone) VALUES
  (1,  'Academic Block A', 'ACADEMIC'),
  (2,  'Academic Block B', 'ACADEMIC'),
  (3,  'Central Library',  'ACADEMIC'),
  (4,  'MRD Auditorium',   'AMENITIES'),
  (5,  'Food Court',       'AMENITIES'),
  (6,  'Sports Complex',   'SPORTS'),
  (7,  'Boys Hostel',      'HOSTEL'),
  (8,  'Girls Hostel',     'HOSTEL'),
  (9,  'Admin Block',      'ADMIN'),
  (10, 'Main Gate',        'ADMIN');

INSERT INTO locations (location_id, building_id, location_name, floor_no, is_collection_point) VALUES
  (1,  1,  'Ground Floor Lobby',     0,    FALSE),
  (2,  1,  'Classroom A-204',        2,    FALSE),
  (3,  1,  'Computer Lab A-310',     3,    FALSE),
  (4,  1,  'Seminar Hall A-501',     5,    FALSE),
  (5,  2,  'Ground Floor Lobby',     0,    FALSE),
  (6,  2,  'Exam Hall B-105',        1,    FALSE),
  (7,  2,  'Electronics Lab B-220',  2,    FALSE),
  (8,  3,  'Reading Hall',           1,    FALSE),
  (9,  3,  'Reference Section',      2,    FALSE),
  (10, 3,  'Library Help Desk',      0,    TRUE),
  (11, 4,  'Main Hall',              0,    FALSE),
  (12, 4,  'Green Room',             0,    FALSE),
  (13, 5,  'Seating Area',           0,    FALSE),
  (14, 5,  'Juice Counter',          0,    FALSE),
  (15, 6,  'Gym',                    1,    FALSE),
  (16, 6,  'Basketball Court',       NULL, FALSE),
  (17, 6,  'Badminton Hall',         0,    FALSE),
  (18, 6,  'Cricket Ground',         NULL, FALSE),
  (19, 7,  'Mess Hall',              0,    FALSE),
  (20, 7,  'Common Room',            1,    FALSE),
  (21, 8,  'Mess Hall',              0,    FALSE),
  (22, 8,  'Reading Room',           1,    FALSE),
  (23, 9,  'Lost & Found Desk',      0,    TRUE),
  (24, 9,  'Accounts Office',        1,    FALSE),
  (25, 10, 'Security Cabin',         0,    TRUE),
  (26, 10, 'Bike Parking',           NULL, FALSE),
  (27, 10, 'Bus Bay',                NULL, FALSE);

-- ------------------------------------------------------------ lost reports
INSERT INTO lost_items (lost_id, owner_id, category_id, location_id, title, description, color, brand, lost_date, status) VALUES
  (1,  7,  2,  8,  'OnePlus Nord CE 3 phone', 'Black OnePlus Nord CE 3 in a transparent back cover with a small crack on the top-left of the screen guard. Lock screen shows a golden retriever.', 'black', 'OnePlus', CURDATE() - INTERVAL 5 DAY, 'OPEN'),
  (2,  6,  23, 13, 'Blue Wildcraft backpack', 'Navy blue Wildcraft backpack with two compartments. Has a DBMS notebook, a pencil pouch and a steel bottle inside. Eiffel tower keychain on the zip.', 'blue', 'Wildcraft', CURDATE() - INTERVAL 12 DAY, 'OPEN'),
  (3,  4,  12, 1,  'PES University ID card', 'Student ID card on a blue lanyard with SRN PES1UG24AM170. A small metro card holder is attached to the lanyard.', 'blue', NULL, CURDATE() - INTERVAL 3 DAY, 'OPEN'),
  (4,  8,  5,  15, 'boAt Airdopes white earbuds', 'White boAt Airdopes 141 charging case with both earbuds inside. Pink heart sticker on the back of the case.', 'white', 'boAt', CURDATE() - INTERVAL 3 DAY, 'OPEN'),
  (5,  9,  7,  6,  'Casio fx-991EX calculator', 'Casio fx-991EX ClassWiz scientific calculator, ARJUN N scratched on the back cover. Left it after the maths exam.', 'black', 'Casio', CURDATE() - INTERVAL 20 DAY, 'OPEN'),
  (6,  5,  16, 27, 'Brown leather wallet', 'Brown Woodland leather wallet with around 600 rupees, my college ID, an Aadhaar card copy and a small family photo.', 'brown', 'Woodland', CURDATE() - INTERVAL 2 DAY, 'OPEN'),
  (7,  10, 6,  3,  'HP laptop charger 65W', 'Black HP 65W laptop charger with the blue round pin. The cable has yellow tape near the plug.', 'black', 'HP', CURDATE() - INTERVAL 6 DAY, 'OPEN'),
  (8,  11, 36, 16, 'Milton steel water bottle', 'Blue Milton Thermosteel 1 litre bottle with an Avengers sticker and a dent near the bottom.', 'blue', 'Milton', CURDATE() - INTERVAL 4 DAY, 'OPEN'),
  (9,  12, 18, 4,  'Ray-Ban spectacles in brown case', 'Black rectangular Ray-Ban prescription glasses, power -2.5, inside a brown hard case with D.M. written inside.', 'black', 'Ray-Ban', CURDATE() - INTERVAL 9 DAY, 'OPEN'),
  (10, 13, 31, 11, 'Grey Nike hoodie', 'Grey Nike hoodie, size L, white swoosh logo. There was a pen and an earphone wire in the front pocket.', 'grey', 'Nike', CURDATE() - INTERVAL 15 DAY, 'OPEN'),
  (11, 14, 27, 9,  'Navathe DBMS textbook', 'Fundamentals of Database Systems by Elmasri and Navathe, 7th edition. Meera written on the first page, yellow highlighting in chapter 14.', 'multicolor', 'Pearson', CURDATE() - INTERVAL 10 DAY, 'OPEN'),
  (12, 15, 20, 26, 'Honda bike keys', 'Two Honda Activa keys on a ring with a red Honda keychain and a small bottle opener.', 'silver', 'Honda', CURDATE() - INTERVAL 1 DAY, 'OPEN'),
  (13, 16, 8,  17, 'Apple Watch SE', 'Apple Watch SE 40mm with a midnight black sport band. Small scratch on the right side of the screen.', 'black', 'Apple', CURDATE() - INTERVAL 7 DAY, 'OPEN'),
  (14, 17, 21, 5,  'Red umbrella', 'Red foldable umbrella with a black handle, Sun Brand printed on the strap.', 'red', NULL, CURDATE() - INTERVAL 30 DAY, 'OPEN'),
  (15, 18, 10, 3,  'SanDisk 64GB pendrive', 'SanDisk Ultra 64GB pendrive, black and red, with my mini-project files. A blue thread is tied to it.', 'black', 'SanDisk', CURDATE() - INTERVAL 11 DAY, 'OPEN'),
  (16, 20, 19, 21, 'Gold stud earring', 'Single small gold stud earring with a tiny red stone, lost during dinner at the mess.', 'gold', NULL, CURDATE() - INTERVAL 6 DAY, 'OPEN'),
  (17, 19, 4,  20, 'JBL over-ear headphones', 'Black JBL Tune 510BT wireless over-ear headphones, left ear cushion slightly torn.', 'black', 'JBL', CURDATE() - INTERVAL 3 DAY, 'OPEN'),
  (18, 7,  13, 14, 'SBI debit card', 'SBI debit card in the name of Rohan Mehta, blue colour. Card is blocked but I need it back.', 'blue', 'SBI', CURDATE() - INTERVAL 2 DAY, 'OPEN'),
  (19, 9,  34, 18, 'SG cricket bat', 'SG Kashmir willow cricket bat with a black grip, initials A.N. on the handle.', 'other', 'SG', CURDATE() - INTERVAL 25 DAY, 'OPEN'),
  (20, 4,  28, 7,  'Analog circuits lab record', 'Blue cover lab record book for Analog Circuits with 8 completed experiments and my SRN on the cover.', 'blue', NULL, CURDATE() - INTERVAL 5 DAY, 'OPEN'),
  (21, 13, 32, 16, 'Black Puma cap', 'Black Puma baseball cap with a white logo, slightly faded.', 'black', 'Puma', CURDATE() - INTERVAL 18 DAY, 'CLOSED'),
  (22, 6,  2,  11, 'Samsung Galaxy M34 phone', 'Blue Samsung Galaxy M34 in a black rugged case, wallpaper is a mountain sunset.', 'blue', 'Samsung', CURDATE() - INTERVAL 1 DAY, 'OPEN'),
  (23, 10, 9,  8,  'Mi power bank 10000mAh', 'White Xiaomi 10000mAh power bank with a USB-C cable wrapped around it.', 'white', 'Xiaomi', CURDATE() - INTERVAL 2 DAY, 'OPEN'),
  (24, 20, 36, 22, 'Green Tupperware lunch box', 'Green Tupperware lunch box set, two containers inside a cloth bag.', 'green', 'Tupperware', CURDATE() - INTERVAL 13 DAY, 'OPEN'),
  (25, 12, 3,  8,  'MacBook Air M1', 'Silver MacBook Air M1 with NASA and Python stickers on the lid.', 'silver', 'Apple', CURDATE() - INTERVAL 40 DAY, 'CLOSED'),
  (26, 11, 17, 15, 'Fossil analog watch', 'Fossil watch with a brown leather strap and round dial, K.R. engraved on the back.', 'brown', 'Fossil', CURDATE() - INTERVAL 75 DAY, 'OPEN'),
  (27, 19, 23, 19, 'Black Skybags backpack', 'Black Skybags backpack with a laptop charger and my hostel room key inside.', 'black', 'Skybags', CURDATE() - INTERVAL 95 DAY, 'OPEN'),
  (28, 14, 12, 13, 'College ID card', 'Student ID card on a red lanyard, SRN PES1UG25BT014.', 'red', NULL, CURDATE() - INTERVAL 120 DAY, 'OPEN'),
  (29, 15, 2,  26, 'iPhone 13 blue', 'Blue iPhone 13 in a clear MagSafe case, back glass is cracked.', 'blue', 'Apple', CURDATE() - INTERVAL 150 DAY, 'OPEN'),
  (30, 17, 31, 4,  'Black denim jacket', 'Black Levis denim jacket with a pin badge on the collar.', 'black', 'Levis', CURDATE() - INTERVAL 60 DAY, 'CLOSED'),
  (31, 8,  29, 2,  'Parker pen set', 'Silver Parker Vector pen in a blue gift box, gift from my father.', 'silver', 'Parker', CURDATE() - INTERVAL 45 DAY, 'OPEN'),
  (32, 18, 14, 24, 'Fee receipt file', 'Plastic file with my semester fee receipts and scholarship documents.', 'other', NULL, CURDATE() - INTERVAL 4 DAY, 'OPEN');

-- ------------------------------------------------------------ found reports
INSERT INTO found_items (found_id, finder_id, category_id, location_id, held_at_id, title, description, color, brand, hidden_marks, found_date, status) VALUES
  (1,  15, 2,  8,  10, 'Black OnePlus smartphone', 'Black OnePlus phone in a transparent cover found on a reading table near the window. Screen guard cracked at one corner.', 'black', 'OnePlus', 'Lock screen photo of a golden retriever; IMEI ends 4471', CURDATE() - INTERVAL 5 DAY, 'AVAILABLE'),
  (2,  9,  23, 13, 23, 'Navy blue backpack', 'Navy blue Wildcraft backpack left on a food court chair. Contains notebooks and a bottle.', 'blue', 'Wildcraft', 'Eiffel tower keychain on the zip; notebook labelled DBMS', CURDATE() - INTERVAL 12 DAY, 'AVAILABLE'),
  (3,  2,  12, 1,  25, 'Student ID card with blue lanyard', 'PES student ID card found on the floor of the Block A lobby, blue lanyard with a card holder.', 'blue', NULL, 'SRN PES1UG24AM170; metro card holder attached', CURDATE() - INTERVAL 3 DAY, 'AVAILABLE'),
  (4,  13, 5,  15, 23, 'White wireless earbuds case', 'White boAt earbuds charging case found near the treadmills in the gym.', 'white', 'boAt', 'Pink heart sticker on the back of the case', CURDATE() - INTERVAL 3 DAY, 'AVAILABLE'),
  (5,  3,  7,  6,  23, 'Casio scientific calculator', 'Casio fx-991EX found under a desk in exam hall B-105 after the mid-semester exam.', 'black', 'Casio', 'Name ARJUN N scratched on the back cover', CURDATE() - INTERVAL 19 DAY, 'AVAILABLE'),
  (6,  2,  16, 27, 25, 'Brown leather wallet', 'Brown leather wallet found at the bus bay near platform 2. Contains cash and some cards.', 'brown', NULL, 'Family photo inside; about 600 rupees; Aadhaar copy', CURDATE() - INTERVAL 1 DAY, 'AVAILABLE'),
  (7,  4,  6,  3,  23, 'Laptop charger HP', 'HP 65W laptop charger left plugged in at computer 14 in lab A-310.', 'black', 'HP', 'Yellow tape mark near the plug', CURDATE() - INTERVAL 6 DAY, 'AVAILABLE'),
  (8,  7,  36, 16, 25, 'Blue steel water bottle', 'Blue steel bottle with superhero stickers found on the basketball court bench.', 'blue', NULL, 'Dent near the bottom; Avengers sticker', CURDATE() - INTERVAL 4 DAY, 'AVAILABLE'),
  (9,  5,  18, 4,  23, 'Spectacles in a brown case', 'Black framed glasses inside a brown hard case found in seminar hall A-501, row 3.', 'black', 'Ray-Ban', 'Power about -2.5; D.M. written inside the case', CURDATE() - INTERVAL 8 DAY, 'AVAILABLE'),
  (10, 20, 31, 12, 23, 'Grey Nike sweatshirt', 'Grey hooded Nike sweatshirt, size L, found in the auditorium green room after the cultural event.', 'grey', 'Nike', 'Pen and earphone wire in the front pocket', CURDATE() - INTERVAL 14 DAY, 'AVAILABLE'),
  (11, 16, 27, 8,  10, 'Database systems textbook', 'Thick DBMS textbook by Elmasri and Navathe left on a reading hall table, lots of highlighting.', 'multicolor', 'Pearson', 'Name on the first page; yellow highlights in chapter 14', CURDATE() - INTERVAL 9 DAY, 'AVAILABLE'),
  (12, 2,  20, 26, 25, 'Bunch of bike keys', 'Two scooter keys on a ring with a red keychain found in the bike parking area.', 'silver', 'Honda', 'Small bottle opener on the ring', CURDATE() - INTERVAL 1 DAY, 'AVAILABLE'),
  (13, 6,  8,  17, 23, 'Black Apple smartwatch', 'Apple Watch with a black sport band found on the badminton hall bench.', 'black', 'Apple', 'Scratch on the right side of the screen; 40mm', CURDATE() - INTERVAL 7 DAY, 'AVAILABLE'),
  (14, 12, 21, 5,  23, 'Red foldable umbrella', 'Red umbrella with a black handle found at the Block B lobby umbrella stand.', 'red', NULL, 'Sun Brand on the strap', CURDATE() - INTERVAL 29 DAY, 'AVAILABLE'),
  (15, 11, 10, 3,  23, 'SanDisk pendrive', 'Black and red SanDisk pendrive found plugged into computer 12 in lab A-310.', 'black', 'SanDisk', 'Blue thread tied to it; folder MiniProject_Final', CURDATE() - INTERVAL 11 DAY, 'AVAILABLE'),
  (16, 3,  17, 15, 23, 'Brown analog wrist watch', 'Fossil watch with a brown leather strap found in the gym changing room.', 'brown', 'Fossil', 'Engraving K.R. on the back', CURDATE() - INTERVAL 74 DAY, 'AVAILABLE'),
  (17, 9,  23, 19, 25, 'Black backpack in mess', 'Black Skybags backpack left in the boys hostel mess hall after dinner.', 'black', 'Skybags', 'Hostel room key B-214 inside', CURDATE() - INTERVAL 94 DAY, 'AVAILABLE'),
  (18, 2,  12, 13, 25, 'ID card with red lanyard', 'Student ID card with a red lanyard found in the food court.', 'red', NULL, 'SRN PES1UG25BT014', CURDATE() - INTERVAL 119 DAY, 'AVAILABLE'),
  (19, 3,  2,  26, 25, 'Blue iPhone with MagSafe case', 'Blue iPhone found near the bike parking entrance, back glass is cracked.', 'blue', 'Apple', 'Beach wallpaper; cracked back glass', CURDATE() - INTERVAL 149 DAY, 'AVAILABLE'),
  (20, 14, 21, 27, 25, 'Black umbrella', 'Large black umbrella with a wooden handle found at the bus bay shelter.', 'black', NULL, NULL, CURDATE() - INTERVAL 3 DAY, 'AVAILABLE'),
  (21, 17, 28, 2,  23, 'Engineering physics notes', 'Spiral notebook with handwritten engineering physics notes, no name on the cover.', 'yellow', NULL, 'Roll number 23 on the last page', CURDATE() - INTERVAL 8 DAY, 'AVAILABLE'),
  (22, 18, 35, 18, 25, 'Nivia football', 'White and black Nivia football found near the cricket ground boundary.', 'white', 'Nivia', NULL, CURDATE() - INTERVAL 21 DAY, 'AVAILABLE'),
  (23, 19, 4,  13, 23, 'Wired earphones', 'Black wired earphones with an in-line mic found on a food court table.', 'black', NULL, NULL, CURDATE() - INTERVAL 5 DAY, 'AVAILABLE'),
  (24, 3,  14, 24, 23, 'Plastic file with fee receipts', 'Transparent plastic file with fee receipts and scholarship forms, left at the accounts office counter.', 'other', NULL, 'Scholarship form in the name of P. Shetty', CURDATE() - INTERVAL 3 DAY, 'AVAILABLE'),
  (25, 20, 19, 13, 23, 'Silver bracelet', 'Thin silver bracelet with a small heart charm found near the juice counter.', 'silver', NULL, 'Charm engraved with the letter S', CURDATE() - INTERVAL 9 DAY, 'AVAILABLE'),
  (26, 7,  4,  8,  10, 'Sony headphones', 'Black Sony WH-CH520 wireless headphones found in the library reading hall.', 'black', 'Sony', 'Left cushion intact; name sticker removed', CURDATE() - INTERVAL 2 DAY, 'AVAILABLE'),
  (27, 10, 31, 13, 23, 'Blue denim jacket', 'Blue Levis denim jacket found on a food court chair.', 'blue', 'Levis', NULL, CURDATE() - INTERVAL 11 DAY, 'AVAILABLE'),
  (28, 11, 25, 3,  23, 'Grey laptop sleeve', 'Grey 14 inch laptop sleeve, empty, found in lab A-310.', 'grey', NULL, NULL, CURDATE() - INTERVAL 7 DAY, 'AVAILABLE'),
  (29, 2,  24, 11, 25, 'Pink handbag', 'Pink Lavie handbag found under a seat in the MRD auditorium after the fest.', 'pink', 'Lavie', 'Contains only a lipstick and a hair clip', CURDATE() - INTERVAL 50 DAY, 'AVAILABLE'),
  (30, 3,  36, 21, 23, 'Pink water bottle', 'Pink plastic water bottle found in the girls hostel mess.', 'pink', NULL, NULL, CURDATE() - INTERVAL 70 DAY, 'DISPOSED'),
  (31, 16, 17, 15, 23, 'Fastrack digital watch', 'Black Fastrack digital sports watch found in the gym locker area.', 'black', 'Fastrack', 'One strap hole widened', CURDATE() - INTERVAL 16 DAY, 'AVAILABLE'),
  (32, 13, 2,  27, 25, 'Redmi Note phone', 'Black Redmi Note phone with a cracked screen found at the bus bay.', 'black', 'Xiaomi', 'Wallpaper of a cricket stadium', CURDATE() - INTERVAL 2 DAY, 'AVAILABLE');

-- realistic report timestamps (a few hours after the lost / found date)
UPDATE lost_items  SET created_at = TIMESTAMP(lost_date)  + INTERVAL (9 + lost_id MOD 9) HOUR,  updated_at = created_at;
UPDATE found_items SET created_at = TIMESTAMP(found_date) + INTERVAL (10 + found_id MOD 8) HOUR, updated_at = created_at;
UPDATE audit_log   SET changed_at = NOW() - INTERVAL 1 HOUR;

-- ------------------------------------------------------------ rule-based matching (pure SQL)
-- Semantic scores are added later by `npm run vector:sync` (vector database).
CALL sp_refresh_all_rule_matches(0.30);

-- ------------------------------------------------------------ claims -> verifications -> returns
-- Inserted directly with historical timestamps; the triggers keep every status consistent.
INSERT INTO claims (claim_id, found_id, claimant_id, lost_id, proof_details, claimed_at) VALUES
  (1,  1,  7,  1,    'Lock screen shows my golden retriever and the IMEI ends with 4471.', NOW() - INTERVAL 4 DAY),
  (2,  2,  6,  2,    'Eiffel tower keychain on the zipper and a DBMS notebook with my name inside.', NOW() - INTERVAL 11 DAY),
  (3,  3,  4,  3,    'My SRN PES1UG24AM170 is on the card and a metro card holder is attached to the lanyard.', NOW() - INTERVAL 2 DAY),
  (4,  4,  8,  4,    'There is a pink heart sticker on the back of the case. They are boAt Airdopes 141.', NOW() - INTERVAL 2 DAY),
  (5,  5,  9,  5,    'My name ARJUN N is scratched on the back cover of the calculator.', NOW() - INTERVAL 18 DAY),
  (6,  6,  5,  6,    'Brown Woodland wallet with my family photo, about 600 rupees and an Aadhaar copy.', NOW() - INTERVAL 1 DAY),
  (7,  6,  19, NULL, 'It is my brown wallet, I lost it near the bus stop yesterday evening.', NOW() - INTERVAL 1 DAY),
  (8,  9,  19, NULL, 'These are my black spectacles, I lost them in the seminar hall.', NOW() - INTERVAL 7 DAY),
  (9,  9,  12, 9,    'Ray-Ban glasses with power -2.5 in a brown case that has D.M. written inside.', NOW() - INTERVAL 6 DAY),
  (10, 13, 16, 13,   'Apple Watch SE 40mm with a scratch on the right side of the screen, paired to my iPhone.', NOW() - INTERVAL 6 DAY),
  (11, 14, 17, 14,   'Red Sun Brand umbrella with a black handle, I left it at the Block B stand.', NOW() - INTERVAL 28 DAY),
  (12, 16, 11, 26,   'Fossil watch with K.R. engraved on the back, my initials.', NOW() - INTERVAL 73 DAY),
  (13, 17, 19, 27,   'Skybags backpack with my hostel room key B-214 inside.', NOW() - INTERVAL 93 DAY),
  (14, 18, 14, 28,   'This is my ID card, SRN PES1UG25BT014 on a red lanyard.', NOW() - INTERVAL 119 DAY),
  (15, 19, 15, 29,   'Blue iPhone 13 with a beach wallpaper and a cracked back glass.', NOW() - INTERVAL 148 DAY);

SET @app_user_id = 3;
INSERT INTO verifications (claim_id, verifier_id, decision, remarks, verified_at) VALUES
  (1,  3, 'APPROVED', 'IMEI and lock screen matched.',                      NOW() - INTERVAL 4 DAY),
  (2,  2, 'APPROVED', 'Keychain and notebook matched.',                     NOW() - INTERVAL 11 DAY),
  (3,  2, 'APPROVED', 'SRN on card matches the claimant.',                  NOW() - INTERVAL 2 DAY),
  (5,  3, 'APPROVED', 'Name scratched on the calculator matches.',          NOW() - INTERVAL 18 DAY),
  (8,  3, 'REJECTED', 'Could not describe the case markings or the power.', NOW() - INTERVAL 7 DAY),
  (9,  3, 'APPROVED', 'Power and initials in the case matched.',            NOW() - INTERVAL 6 DAY),
  (10, 2, 'APPROVED', 'Watch unlocked by the claimant in front of staff.',  NOW() - INTERVAL 5 DAY),
  (11, 3, 'APPROVED', 'Brand on the strap matched.',                        NOW() - INTERVAL 28 DAY),
  (12, 3, 'APPROVED', 'Engraving matched.',                                 NOW() - INTERVAL 73 DAY),
  (13, 2, 'APPROVED', 'Room key matched hostel records.',                   NOW() - INTERVAL 93 DAY),
  (14, 2, 'APPROVED', 'SRN matched.',                                       NOW() - INTERVAL 119 DAY),
  (15, 3, 'APPROVED', 'Wallpaper and crack matched.',                       NOW() - INTERVAL 148 DAY);

INSERT INTO item_returns (claim_id, handled_by, id_proof_checked, handover_status, returned_at, remarks) VALUES
  (1,  3, TRUE, 'HANDED_OVER', NOW() - INTERVAL 3 DAY,   'Handed over at the library help desk.'),
  (2,  3, TRUE, 'HANDED_OVER', NOW() - INTERVAL 10 DAY,  NULL),
  (5,  3, TRUE, 'HANDED_OVER', NOW() - INTERVAL 17 DAY,  NULL),
  (9,  3, TRUE, 'HANDED_OVER', NOW() - INTERVAL 5 DAY,   NULL),
  (11, 2, TRUE, 'HANDED_OVER', NOW() - INTERVAL 27 DAY,  NULL),
  (12, 3, TRUE, 'HANDED_OVER', NOW() - INTERVAL 72 DAY,  NULL),
  (13, 2, TRUE, 'HANDED_OVER', NOW() - INTERVAL 92 DAY,  'Collected from the security cabin.'),
  (14, 2, TRUE, 'HANDED_OVER', NOW() - INTERVAL 118 DAY, NULL),
  (15, 3, TRUE, 'HANDED_OVER', NOW() - INTERVAL 147 DAY, 'Owner showed purchase bill.');
SET @app_user_id = NULL;

-- notifications about cases that are already closed are marked as read
UPDATE notifications
   SET is_read = TRUE
 WHERE link IN (SELECT CONCAT('/claims/', claim_id) FROM claims WHERE claim_status <> 'PENDING')
    OR notif_type = 'RETURN';
