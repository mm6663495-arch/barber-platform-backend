# 🔐 Two-Factor Authentication Module

Enterprise-grade 2FA system with Google Authenticator

---

## 📋 Overview

Complete Two-Factor Authentication module providing:
- ✅ Google Authenticator integration
- ✅ QR Code generation
- ✅ 10 Backup codes per user
- ✅ JWT-protected API
- ✅ SHA256 encryption

---

## 📁 Structure

```
two-factor/
├── two-factor.service.ts      # Core 2FA logic
├── two-factor.controller.ts   # API endpoints (7)
├── two-factor.module.ts       # Module definition
├── dto/
│   └── two-factor.dto.ts      # Validation DTOs
└── guards/
    └── two-factor.guard.ts    # Authentication guard
```

---

## 🎯 Features

### 1. Setup & Enable
```typescript
// Generate secret & QR code
await twoFactorService.generateSecret(userId, email);

// Enable 2FA with verification
await twoFactorService.enable2FA(userId, token);
```

### 2. Verification
```typescript
// Verify TOTP code
await twoFactorService.verifyToken(userId, token);

// Verify backup code
await twoFactorService.verifyBackupCode(userId, code);

// Verify either
await twoFactorService.verify2FA(userId, code);
```

### 3. Backup Codes
```typescript
// Generate 10 codes
const codes = await twoFactorService.generateBackupCodes(userId);

// Regenerate (invalidates old codes)
const newCodes = await twoFactorService.regenerateBackupCodes(userId, token);
```

### 4. Management
```typescript
// Get status
const status = await twoFactorService.get2FAStatus(userId);

// Disable 2FA
await twoFactorService.disable2FA(userId, password);
```

---

## 🔌 Usage

### In Other Services:

```typescript
import { TwoFactorModule } from './two-factor/two-factor.module';
import { TwoFactorService } from './two-factor/two-factor.service';

@Module({
  imports: [TwoFactorModule],
})
export class YourModule {}

@Injectable()
export class YourService {
  constructor(private twoFactorService: TwoFactorService) {}

  async requiresAuth(userId: number) {
    const requires = await this.twoFactorService.requires2FA(userId);
    if (requires) {
      // Handle 2FA flow
    }
  }
}
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/2fa/setup` | Generate secret & QR |
| POST | `/2fa/enable` | Enable 2FA |
| DELETE | `/2fa/disable` | Disable 2FA |
| POST | `/2fa/verify` | Verify code |
| GET | `/2fa/status` | Get status |
| POST | `/2fa/backup-codes/regenerate` | Regenerate codes |
| POST | `/2fa/backup-codes/verify` | Verify backup |

---

## 🔐 Security

### Encryption:
- **Secrets:** Encrypted in database
- **Backup Codes:** SHA256 hashed
- **JWT:** Required for all endpoints

### Best Practices:
- 30-second TOTP window
- One-time use backup codes
- Password verification for disable
- Rate limiting ready

---

## 📚 Documentation

- **TWO_FACTOR_GUIDE.md** - Complete guide
- **TWO_FACTOR_QUICKSTART.md** - Quick start
- **ابدأ_هنا_2FA.txt** - Arabic guide

---

## ✅ Status

- ✅ Implemented
- ✅ Tested
- ✅ Documented
- ✅ Production Ready

---

**Built with ❤️ for Barber Platform**

