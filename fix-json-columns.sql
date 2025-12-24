-- Ensure JSON columns and defaults for salons/packages

-- Clean existing invalid JSON first
UPDATE Salon SET images='[]'       WHERE images IS NULL OR JSON_VALID(images)=0;
UPDATE Salon SET services='[]'     WHERE services IS NULL OR JSON_VALID(services)=0;
UPDATE Salon SET workingHours='{}' WHERE workingHours IS NULL OR JSON_VALID(workingHours)=0;

UPDATE Package SET images='[]'   WHERE images IS NULL OR JSON_VALID(images)=0;
UPDATE Package SET services='[]' WHERE services IS NULL OR JSON_VALID(services)=0;

-- Convert to JSON types with NOT NULL and defaults
ALTER TABLE Salon
  MODIFY workingHours JSON NOT NULL,
  MODIFY images JSON NOT NULL;

ALTER TABLE Package
  MODIFY services JSON NOT NULL,
  MODIFY images JSON NOT NULL;

-- Optional: other JSON fields commonly present
UPDATE User SET notificationSettings='{}' WHERE notificationSettings IS NULL OR JSON_VALID(notificationSettings)=0;
UPDATE Notification SET data='{}' WHERE data IS NULL OR JSON_VALID(data)=0;
UPDATE AuditLog SET details='{}' WHERE details IS NULL OR JSON_VALID(details)=0;


