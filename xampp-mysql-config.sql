-- ===========================================
-- Barber Platform Database Configuration for XAMPP
-- ===========================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS `barber_platform` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Use the database
USE `barber_platform`;

-- Create user for the application (optional - for better security)
-- CREATE USER 'barber_user'@'localhost' IDENTIFIED BY 'barber_password';
-- GRANT ALL PRIVILEGES ON barber_platform.* TO 'barber_user'@'localhost';
-- FLUSH PRIVILEGES;

-- ===========================================
-- Database Configuration Settings
-- ===========================================

-- Set MySQL configuration for better performance
SET GLOBAL innodb_buffer_pool_size = 128M;
SET GLOBAL max_connections = 200;
SET GLOBAL query_cache_size = 32M;
SET GLOBAL query_cache_type = 1;

-- Set timezone
SET time_zone = '+00:00';

-- ===========================================
-- Initial Data Setup
-- ===========================================

-- Insert system settings
INSERT INTO SystemSetting (key, value, description) VALUES
('app_name', 'Barber Platform', 'Application name'),
('app_version', '1.0.0', 'Application version'),
('maintenance_mode', 'false', 'Maintenance mode status'),
('registration_enabled', 'true', 'Allow new user registrations'),
('email_verification_required', 'true', 'Require email verification'),
('max_file_size', '5242880', 'Maximum file upload size in bytes'),
('allowed_file_types', 'image/jpeg,image/png,image/gif,image/webp', 'Allowed file types for upload'),
('default_subscription_days', '30', 'Default subscription validity in days'),
('review_edit_window_minutes', '30', 'Time window for editing reviews in minutes'),
('auto_renewal_days_before_expiry', '7', 'Days before expiry to send renewal reminder'),
('rate_limit_requests_per_minute', '100', 'Rate limit for API requests'),
('jwt_expires_in', '7d', 'JWT token expiration time'),
('bcrypt_rounds', '12', 'BCrypt hashing rounds'),
('cors_origins', 'http://localhost:3000,http://localhost:3001', 'Allowed CORS origins'),
('smtp_host', 'smtp.gmail.com', 'SMTP server host'),
('smtp_port', '587', 'SMTP server port'),
('smtp_secure', 'false', 'SMTP secure connection'),
('payment_gateway_mode', 'sandbox', 'Payment gateway mode (sandbox/live)'),
('backup_enabled', 'true', 'Enable automatic backups'),
('backup_retention_days', '30', 'Backup retention period in days'),
('monitoring_enabled', 'true', 'Enable system monitoring'),
('log_level', 'debug', 'Application log level'),
('api_documentation_enabled', 'true', 'Enable API documentation'),
('health_check_enabled', 'true', 'Enable health check endpoint')
ON DUPLICATE KEY UPDATE 
value = VALUES(value),
updatedAt = NOW();

-- ===========================================
-- Performance Optimization
-- ===========================================

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON User(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON User(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON User(isActive);
CREATE INDEX IF NOT EXISTS idx_salons_owner ON Salon(ownerId);
CREATE INDEX IF NOT EXISTS idx_salons_active ON Salon(isActive);
CREATE INDEX IF NOT EXISTS idx_salons_approved ON Salon(isApproved);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON Subscription(customerId);
CREATE INDEX IF NOT EXISTS idx_subscriptions_package ON Subscription(packageId);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON Subscription(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON Subscription(endDate);
CREATE INDEX IF NOT EXISTS idx_visits_subscription ON Visit(subscriptionId);
CREATE INDEX IF NOT EXISTS idx_visits_salon ON Visit(salonId);
CREATE INDEX IF NOT EXISTS idx_visits_date ON Visit(visitDate);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON Review(customerId);
CREATE INDEX IF NOT EXISTS idx_reviews_salon ON Review(salonId);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON Review(rating);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON Payment(subscriptionId);
CREATE INDEX IF NOT EXISTS idx_payments_status ON Payment(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON Notification(userId);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON Notification(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON Notification(isRead);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON AuditLog(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON AuditLog(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON AuditLog(createdAt);

-- ===========================================
-- Database Maintenance
-- ===========================================

-- Create stored procedure for cleanup
DELIMITER //
CREATE PROCEDURE CleanupExpiredData()
BEGIN
    -- Clean up expired reset tokens
    UPDATE User 
    SET resetToken = NULL, resetTokenExpiry = NULL 
    WHERE resetTokenExpiry < NOW();
    
    -- Clean up old audit logs (older than 1 year)
    DELETE FROM AuditLog 
    WHERE createdAt < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    
    -- Clean up old notifications (older than 6 months)
    DELETE FROM Notification 
    WHERE createdAt < DATE_SUB(NOW(), INTERVAL 6 MONTH) 
    AND isRead = true;
END //
DELIMITER ;

-- Create event scheduler for automatic cleanup (runs daily at 2 AM)
SET GLOBAL event_scheduler = ON;
CREATE EVENT IF NOT EXISTS daily_cleanup
ON SCHEDULE EVERY 1 DAY
STARTS '2024-01-01 02:00:00'
DO
  CALL CleanupExpiredData();

-- ===========================================
-- Security Configuration
-- ===========================================

-- Create view for user statistics (read-only)
CREATE VIEW user_stats AS
SELECT 
    role,
    COUNT(*) as total_users,
    COUNT(CASE WHEN isActive = true THEN 1 END) as active_users,
    COUNT(CASE WHEN emailVerified = true THEN 1 END) as verified_users,
    COUNT(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_last_30_days
FROM User 
GROUP BY role;

-- Create view for salon statistics
CREATE VIEW salon_stats AS
SELECT 
    s.id,
    s.name,
    s.rating,
    s.totalReviews,
    COUNT(v.id) as total_visits,
    COUNT(CASE WHEN v.visitDate >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as visits_last_30_days
FROM Salon s
LEFT JOIN Visit v ON s.id = v.salonId
GROUP BY s.id, s.name, s.rating, s.totalReviews;

-- ===========================================
-- Backup Configuration
-- ===========================================

-- Create backup directory (if it doesn't exist)
-- This is handled by the application, but we can set up the structure

-- ===========================================
-- Final Configuration
-- ===========================================

-- Show database configuration
SELECT 'Database Configuration Complete' as status;
SELECT 'barber_platform' as database_name;
SELECT 'utf8mb4' as character_set;
SELECT 'utf8mb4_unicode_ci' as collation;

-- Show table count
SELECT COUNT(*) as total_tables FROM information_schema.tables 
WHERE table_schema = 'barber_platform';

-- Show system settings
SELECT key, value, description FROM SystemSetting 
ORDER BY key;
