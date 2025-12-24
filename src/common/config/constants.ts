/**
 * Application Constants
 * الثوابت المشتركة في التطبيق
 */

// Pagination Constants
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Security Constants
export const SECURITY_CONSTANTS = {
  BCRYPT_ROUNDS: 12,
  JWT_EXPIRY: '7d',
  REFRESH_TOKEN_EXPIRY: '30d',
  RESET_TOKEN_EXPIRY: 3600000, // 1 hour in ms
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPT_WINDOW: 900000, // 15 minutes in ms
} as const;

// Cache Constants
export const CACHE_CONSTANTS = {
  DEFAULT_TTL: 3600, // 1 hour
  USER_PROFILE_TTL: 1800, // 30 minutes
  SALON_LIST_TTL: 600, // 10 minutes
  SUBSCRIPTION_TTL: 300, // 5 minutes
} as const;

// Transaction Constants
export const TRANSACTION_CONSTANTS = {
  MAX_WAIT: 5000, // 5 seconds
  TIMEOUT: 10000, // 10 seconds
  MAX_RETRIES: 3,
} as const;

// File Upload Constants
export const UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_PROFILE_IMAGE_SIZE: 2 * 1024 * 1024, // 2MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
} as const;

// Business Logic Constants
export const BUSINESS_CONSTANTS = {
  MIN_REVIEW_RATING: 1,
  MAX_REVIEW_RATING: 5,
  REVIEW_EDIT_WINDOW: 1800000, // 30 minutes in ms
  EXPIRY_WARNING_DAYS: 7,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication Errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_ACCOUNT_DEACTIVATED: 'AUTH_002',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_003',
  AUTH_2FA_REQUIRED: 'AUTH_004',
  AUTH_2FA_INVALID: 'AUTH_005',
  
  // Authorization Errors
  FORBIDDEN_ACCESS: 'AUTHZ_001',
  FORBIDDEN_RESOURCE: 'AUTHZ_002',
  
  // Validation Errors
  VALIDATION_FAILED: 'VAL_001',
  INVALID_INPUT: 'VAL_002',
  
  // Business Logic Errors
  SUBSCRIPTION_EXPIRED: 'BIZ_001',
  NO_VISITS_REMAINING: 'BIZ_002',
  PACKAGE_NOT_AVAILABLE: 'BIZ_003',
  SALON_NOT_APPROVED: 'BIZ_004',
  
  // Resource Errors
  RESOURCE_NOT_FOUND: 'RES_001',
  RESOURCE_ALREADY_EXISTS: 'RES_002',
  
  // Database Errors
  DATABASE_ERROR: 'DB_001',
  TRANSACTION_FAILED: 'DB_002',
  
  // External Service Errors
  PAYMENT_FAILED: 'EXT_001',
  EMAIL_SEND_FAILED: 'EXT_002',
  UPLOAD_FAILED: 'EXT_003',
} as const;

// API Versioning
export const API_VERSION = {
  V1: 'v1',
  CURRENT: 'v1',
} as const;

// Rate Limiting
export const RATE_LIMIT = {
  DEFAULT: {
    TTL: 60000, // 1 minute
    LIMIT: 100,
  },
  AUTH: {
    TTL: 900000, // 15 minutes
    LIMIT: 5,
  },
  PAYMENT: {
    TTL: 3600000, // 1 hour
    LIMIT: 10,
  },
} as const;

