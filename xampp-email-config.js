// ===========================================
// Barber Platform Email Configuration for XAMPP
// ===========================================

const emailConfig = {
  // ===========================================
  // SMTP Configuration
  // ===========================================
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || 'your-email@gmail.com',
      pass: process.env.SMTP_PASS || 'your-app-password'
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000, // 30 seconds
    socketTimeout: 60000 // 60 seconds
  },

  // ===========================================
  // Email Templates Configuration
  // ===========================================
  templates: {
    from: {
      name: process.env.SMTP_FROM_NAME || 'Barber Platform',
      email: process.env.SMTP_FROM_EMAIL || 'noreply@barberplatform.com'
    },
    replyTo: process.env.SMTP_REPLY_TO || 'support@barberplatform.com',
    baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    logoUrl: process.env.LOGO_URL || 'https://your-domain.com/logo.png',
    companyName: 'Barber Platform',
    supportEmail: 'support@barberplatform.com',
    supportPhone: '+1-555-0123'
  },

  // ===========================================
  // Email Types and Templates
  // ===========================================
  emailTypes: {
    // User Registration
    userRegistration: {
      subject: 'Welcome to Barber Platform - Verify Your Email',
      template: 'user-registration',
      priority: 'high'
    },

    // Email Verification
    emailVerification: {
      subject: 'Verify Your Email Address',
      template: 'email-verification',
      priority: 'high'
    },

    // Password Reset
    passwordReset: {
      subject: 'Reset Your Password',
      template: 'password-reset',
      priority: 'high'
    },

    // Password Changed
    passwordChanged: {
      subject: 'Your Password Has Been Changed',
      template: 'password-changed',
      priority: 'medium'
    },

    // Account Locked
    accountLocked: {
      subject: 'Your Account Has Been Locked',
      template: 'account-locked',
      priority: 'high'
    },

    // Subscription Created
    subscriptionCreated: {
      subject: 'Your Subscription Has Been Created',
      template: 'subscription-created',
      priority: 'medium'
    },

    // Subscription Expiring
    subscriptionExpiring: {
      subject: 'Your Subscription Is Expiring Soon',
      template: 'subscription-expiring',
      priority: 'medium'
    },

    // Subscription Expired
    subscriptionExpired: {
      subject: 'Your Subscription Has Expired',
      template: 'subscription-expired',
      priority: 'high'
    },

    // Visit Confirmation
    visitConfirmation: {
      subject: 'Visit Confirmed - {salonName}',
      template: 'visit-confirmation',
      priority: 'medium'
    },

    // Visit Reminder
    visitReminder: {
      subject: 'Reminder: Your Visit Tomorrow at {salonName}',
      template: 'visit-reminder',
      priority: 'medium'
    },

    // Review Request
    reviewRequest: {
      subject: 'How was your visit at {salonName}?',
      template: 'review-request',
      priority: 'low'
    },

    // Payment Confirmation
    paymentConfirmation: {
      subject: 'Payment Confirmed - {amount}',
      template: 'payment-confirmation',
      priority: 'medium'
    },

    // Payment Failed
    paymentFailed: {
      subject: 'Payment Failed - Action Required',
      template: 'payment-failed',
      priority: 'high'
    },

    // Admin Notifications
    adminNotification: {
      subject: 'Admin Notification - {type}',
      template: 'admin-notification',
      priority: 'high'
    },

    // System Maintenance
    systemMaintenance: {
      subject: 'Scheduled Maintenance Notice',
      template: 'system-maintenance',
      priority: 'medium'
    }
  },

  // ===========================================
  // Email Queue Configuration
  // ===========================================
  queue: {
    enabled: process.env.EMAIL_QUEUE_ENABLED === 'true',
    concurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY) || 5,
    retryAttempts: parseInt(process.env.EMAIL_QUEUE_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.EMAIL_QUEUE_RETRY_DELAY) || 60000, // 1 minute
    maxAge: parseInt(process.env.EMAIL_QUEUE_MAX_AGE) || 86400000, // 24 hours
    removeOnComplete: parseInt(process.env.EMAIL_QUEUE_REMOVE_ON_COMPLETE) || 100,
    removeOnFail: parseInt(process.env.EMAIL_QUEUE_REMOVE_ON_FAIL) || 50
  },

  // ===========================================
  // Email Validation
  // ===========================================
  validation: {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxRecipients: 100,
    maxSubjectLength: 200,
    maxBodyLength: 10000,
    allowedDomains: process.env.ALLOWED_EMAIL_DOMAINS?.split(',') || [],
    blockedDomains: process.env.BLOCKED_EMAIL_DOMAINS?.split(',') || [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com'
    ]
  },

  // ===========================================
  // Email Templates (HTML)
  // ===========================================
  templates: {
    'user-registration': {
      subject: 'Welcome to Barber Platform - Verify Your Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Barber Platform</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50;">Welcome to Barber Platform!</h1>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Hello {{userName}},</h2>
            <p>Thank you for joining Barber Platform! We're excited to have you on board.</p>
            <p>To get started, please verify your email address by clicking the button below:</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{verificationLink}}" 
               style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #2c3e50;">
              <strong>Note:</strong> This verification link will expire in 24 hours. If you didn't create an account with us, please ignore this email.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666;">
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3498db;">{{verificationLink}}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              © 2024 Barber Platform. All rights reserved.<br>
              <a href="{{unsubscribeLink}}" style="color: #3498db;">Unsubscribe</a> | 
              <a href="{{supportLink}}" style="color: #3498db;">Support</a>
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Barber Platform!
        
        Hello {{userName}},
        
        Thank you for joining Barber Platform! We're excited to have you on board.
        
        To get started, please verify your email address by visiting this link:
        {{verificationLink}}
        
        Note: This verification link will expire in 24 hours. If you didn't create an account with us, please ignore this email.
        
        Best regards,
        The Barber Platform Team
        
        ---
        © 2024 Barber Platform. All rights reserved.
        Unsubscribe: {{unsubscribeLink}}
        Support: {{supportLink}}
      `
    },

    'email-verification': {
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50;">Verify Your Email Address</h1>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p>Please click the button below to verify your email address:</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{verificationLink}}" 
               style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email
            </a>
          </div>
          
          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #2c3e50;">
              <strong>Note:</strong> This verification link will expire in 24 hours.
            </p>
          </div>
        </body>
        </html>
      `
    },

    'password-reset': {
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c3e50;">Reset Your Password</h1>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetLink}}" 
               style="background-color: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <div style="background-color: #fdf2e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #d35400;">
              <strong>Security Note:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
          </div>
        </body>
        </html>
      `
    }
  },

  // ===========================================
  // Email Sending Functions
  // ===========================================
  sendEmail: async (to, subject, html, text, attachments = []) => {
    const nodemailer = require('nodemailer');
    
    // Create transporter
    const transporter = nodemailer.createTransporter(emailConfig.smtp);
    
    // Email options
    const mailOptions = {
      from: {
        name: emailConfig.templates.from.name,
        address: emailConfig.templates.from.email
      },
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
      text: text,
      attachments: attachments,
      replyTo: emailConfig.templates.replyTo
    };
    
    try {
      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  },

  // ===========================================
  // Template Processing
  // ===========================================
  processTemplate: (template, variables) => {
    let processedTemplate = template;
    
    // Replace variables in template
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedTemplate = processedTemplate.replace(regex, variables[key] || '');
    });
    
    return processedTemplate;
  },

  // ===========================================
  // Email Validation
  // ===========================================
  validateEmail: (email) => {
    const emailRegex = emailConfig.validation.emailRegex;
    return emailRegex.test(email);
  },

  // ===========================================
  // Bulk Email Sending
  // ===========================================
  sendBulkEmail: async (recipients, subject, html, text, batchSize = 10) => {
    const results = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      try {
        const result = await emailConfig.sendEmail(
          batch,
          subject,
          html,
          text
        );
        results.push({ batch, result, success: true });
      } catch (error) {
        results.push({ batch, error, success: false });
      }
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
};

module.exports = emailConfig;
