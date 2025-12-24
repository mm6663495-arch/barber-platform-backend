# 🚀 WebSocket Module

Real-time communication module for Barber Platform

---

## 📋 Overview

This module provides complete WebSocket functionality including:
- ✅ Real-time Notifications
- ✅ Online/Offline Presence
- ✅ Typing Indicators
- ✅ Chat Rooms
- ✅ REST API Integration

---

## 📁 Structure

```
websocket/
├── websocket.gateway.ts         # Main WebSocket Gateway
├── websocket.module.ts          # Module definition
├── websocket.controller.ts      # REST API endpoints
├── guards/
│   └── ws-jwt.guard.ts          # JWT Authentication
└── services/
    ├── notification.service.ts  # Notifications handling
    ├── presence.service.ts      # Presence tracking
    └── typing.service.ts        # Typing indicators
```

---

## 🎯 Features

### 1. Real-time Notifications 📬
```typescript
// Send notification
await notificationService.sendNotification(userId, {
  type: 'booking:new',
  message: 'New booking received',
  data: { bookingId: 123 },
});
```

### 2. Presence Tracking 🟢
```typescript
// Check if user is online
const isOnline = await presenceService.isUserOnline(userId);
const lastSeen = await presenceService.getLastSeen(userId);
```

### 3. Typing Indicators ⌨️
```typescript
// Track typing
typingService.startTyping(userId, chatId);
typingService.stopTyping(userId, chatId);
```

---

## 🔌 Usage

### In Other Modules:

```typescript
import { WebSocketModule } from './websocket/websocket.module';
import { NotificationService } from './websocket/services/notification.service';

@Module({
  imports: [WebSocketModule],
})
export class YourModule {}

@Injectable()
export class YourService {
  constructor(private notificationService: NotificationService) {}

  async notifyUser(userId: number) {
    await this.notificationService.sendNotification(userId, {
      type: 'custom',
      message: 'Hello!',
    });
  }
}
```

---

## 🌐 WebSocket Events

### Client → Server:
- `notifications:subscribe`
- `notification:send`
- `chat:join`
- `chat:leave`
- `typing:start`
- `typing:stop`
- `presence:get`
- `presence:online-users`

### Server → Client:
- `connected`
- `notification:new`
- `user:online`
- `user:offline`
- `presence:update`
- `typing:started`
- `typing:stopped`

---

## 🔐 Security

All WebSocket messages are protected with JWT:

```typescript
@UseGuards(WsJwtGuard)
@SubscribeMessage('notification:send')
handleSendNotification(...) {
  // Only authenticated users
}
```

---

## 📚 Documentation

- **WEBSOCKET_GUIDE.md** - Complete guide
- **WEBSOCKET_QUICKSTART.md** - Quick start
- **ابدأ_هنا_WEBSOCKET.txt** - Arabic quick start

---

## ✅ Status

- ✅ Implemented
- ✅ Tested
- ✅ Documented
- ✅ Production Ready

---

**Built with ❤️ for Barber Platform**

