// ===========================================
// Barber Platform Security Configuration for XAMPP
// ===========================================

const securityConfig = {
  // ===========================================
  // CORS Configuration
  // ===========================================
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://barber-platform.local',
      'https://barber-platform.local'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Client-Version',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Current-Page',
      'X-Per-Page'
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  },

  // ===========================================
  // Rate Limiting Configuration
  // ===========================================
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 900 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    },
    keyGenerator: (req) => {
      // Use IP address as key
      return req.ip || req.connection.remoteAddress;
    }
  },

  // ===========================================
  // Helmet Security Headers
  // ===========================================
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api.stripe.com", "https://api.paypal.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://www.paypal.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: {
      action: 'deny'
    },
    xssFilter: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
  },

  // ===========================================
  // JWT Configuration
  // ===========================================
  jwt: {
    secret: process.env.JWT_SECRET || 'barber-platform-super-secret-jwt-key-2024-xampp-dev',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256',
    issuer: 'barber-platform',
    audience: 'barber-platform-users',
    clockTolerance: 30, // 30 seconds
    ignoreExpiration: false,
    ignoreNotBefore: false
  },

  // ===========================================
  // Password Security
  // ===========================================
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    commonPasswords: [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ]
  },

  // ===========================================
  // Session Security
  // ===========================================
  session: {
    secret: process.env.SESSION_SECRET || 'barber-platform-session-secret-xampp-2024',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    },
    name: 'barber-platform-session'
  },

  // ===========================================
  // File Upload Security
  // ===========================================
  fileUpload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    uploadPath: process.env.UPLOAD_DEST || './uploads',
    scanForViruses: true,
    generateThumbnails: true,
    thumbnailSizes: [
      { width: 150, height: 150, suffix: '_thumb' },
      { width: 300, height: 300, suffix: '_medium' }
    ]
  },

  // ===========================================
  // API Security
  // ===========================================
  api: {
    version: 'v1',
    prefix: '/api',
    timeout: 30000, // 30 seconds
    maxRequestSize: '10mb',
    enableCompression: true,
    enableCaching: true,
    cacheTTL: 3600, // 1 hour
    enableMetrics: true,
    enableTracing: true
  },

  // ===========================================
  // Database Security
  // ===========================================
  database: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
    logging: process.env.NODE_ENV === 'development'
  },

  // ===========================================
  // Input Validation
  // ===========================================
  validation: {
    maxStringLength: 1000,
    maxArrayLength: 100,
    maxObjectDepth: 10,
    sanitizeHtml: true,
    trimStrings: true,
    normalizeEmails: true,
    validateUrls: true,
    validateEmails: true,
    validatePhones: true
  },

  // ===========================================
  // Logging Security
  // ===========================================
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined',
    excludeSensitiveData: true,
    maskPasswords: true,
    maskTokens: true,
    maskEmails: true,
    logFile: process.env.LOG_FILE || './logs/security.log',
    maxSize: '10m',
    maxFiles: 5,
    auditLog: {
      enabled: true,
      logLevel: 'info',
      includeRequestBody: false,
      includeResponseBody: false,
      maskSensitiveData: true
    }
  },

  // ===========================================
  // Monitoring and Alerting
  // ===========================================
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metrics: {
      enabled: process.env.METRICS_ENABLED === 'true',
      endpoint: '/metrics',
      collectDefaultMetrics: true
    },
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
      endpoint: '/health',
      timeout: 5000
    },
    alerts: {
      enabled: true,
      email: process.env.ALERT_EMAIL,
      webhook: process.env.ALERT_WEBHOOK,
      thresholds: {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5 seconds
        memoryUsage: 0.8, // 80%
        cpuUsage: 0.8 // 80%
      }
    }
  },

  // ===========================================
  // Backup Security
  // ===========================================
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    path: process.env.BACKUP_PATH || './backups',
    encryption: true,
    compression: true,
    excludePatterns: [
      'node_modules',
      '.git',
      'logs',
      'temp',
      'cache'
    ]
  },

  // ===========================================
  // Development vs Production
  // ===========================================
  environment: {
    development: {
      cors: {
        origin: true, // Allow all origins in development
        credentials: true
      },
      helmet: {
        contentSecurityPolicy: false
      },
      logging: {
        level: 'debug',
        includeRequestBody: true
      }
    },
    production: {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['https://yourdomain.com']
      },
      helmet: {
        contentSecurityPolicy: true
      },
      logging: {
        level: 'warn',
        includeRequestBody: false
      }
    }
  }
};

// ===========================================
// Security Middleware Functions
// ===========================================

const securityMiddleware = {
  // CORS middleware
  cors: (app) => {
    const cors = require('cors');
    const config = securityConfig.cors;
    
    if (process.env.NODE_ENV === 'development') {
      config.origin = true;
    }
    
    app.use(cors(config));
  },

  // Helmet middleware
  helmet: (app) => {
    const helmet = require('helmet');
    const config = securityConfig.helmet;
    
    app.use(helmet(config));
  },

  // Rate limiting middleware
  rateLimit: (app) => {
    const rateLimit = require('express-rate-limit');
    const config = securityConfig.rateLimit;
    
    app.use(rateLimit(config));
  },

  // Request sanitization
  sanitize: (req, res, next) => {
    // Remove null bytes
    const sanitizeString = (str) => {
      if (typeof str === 'string') {
        return str.replace(/\0/g, '');
      }
      return str;
    };

    // Recursively sanitize object
    const sanitizeObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      } else {
        return sanitizeString(obj);
      }
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  },

  // Security headers
  securityHeaders: (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  }
};

module.exports = {
  securityConfig,
  securityMiddleware
};
