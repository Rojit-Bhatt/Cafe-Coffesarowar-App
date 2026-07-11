# Document 02: Data Models & Relationship Schema

## 1. Feature Dependency Flow
The software modules must be built in this strict linear order to ensure underlying dependencies are satisfied:
Authentication ──> Users ──> Stamp Cards ──> QR Tokens ──> Scanning & Verification ──> Voucher Generation ──> Voucher Redemption

## 2. Database Collection Definitions (Mongoose Schemas)

### User Model (`models/User.js`)
```javascript
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  createdAt: { type: Date, default: Date.now }
});
StampCard Model (models/StampCard.js)
JavaScript
const StampCardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  stampsEarned: { type: Number, min: 0, max: 5, default: 0 },
  lastStampedAt: { type: Date, default: null }
});
DynamicQRToken Model (models/DynamicQRToken.js)
JavaScript
const DynamicQRTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true }, // UUID v4 format
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
// Automated core index setting for self-destructing data layers
DynamicQRTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 });
Voucher Model (models/Voucher.js)
JavaScript
const VoucherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voucherCode: { type: String, required: true, unique: true }, // Format: CAFE-XXXXXX
  isValid: { type: Boolean, default: true },
  earnedAt: { type: Date, default: Date.now },
  redeemedAt: { type: Date, default: null }
});
