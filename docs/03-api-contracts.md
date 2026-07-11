# Document 03: REST API Contracts & Payload Definitions

## 1. Authentication Endpoints

### `POST /api/auth/register`
* **Access:** Public
* **Request Body:**
```json
{
  "name": "Rojit Bhatt",
  "email": "rojit@example.com",
  "password": "securePassword123"
}
Response (201 Created):
JSON
{
  "success": true,
  "message": "User registered successfully."
}
POST /api/auth/login
Access: Public
Request Body:
JSON
{
  "email": "rojit@example.com",
  "password": "securePassword123"
}
Response (200 OK):
JSON
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec9f872d9b2a1c8b4567",
    "name": "Rojit Bhatt",
    "role": "customer"
  }
}
2. Loyalty Stamp Logic Endpoints
POST /api/admin/generate-qr
Access: Protected (Admin Only)
Request Body: None
Response (201 Created):
JSON
{
  "success": true,
  "data": {
    "token": "d7b2a945-8c31-4e78-901a-2b3c4d5e6f7g",
    "expiresInSeconds": 30
  }
}
POST /api/stamps/claim
Access: Protected (Customer Only)
Request Body:
JSON
{
  "token": "d7b2a945-8c31-4e78-901a-2b3c4d5e6f7g"
}
Response - Standard Increment (200 OK):
JSON
{
  "success": true,
  "message": "Stamp successfully added to your card.",
  "data": {
    "stampsEarned": 3,
    "rewardTriggered": false
  }
}
Response - Reward Milestone Reached (200 OK):
JSON
{
  "success": true,
  "message": "Milestone reached! You have earned a free coffee voucher.",
  "data": {
    "stampsEarned": 0,
    "rewardTriggered": true,
    "voucherCode": "CAFE-AB12CD34"
  }
}
3. Voucher Tracking Endpoints
GET /api/vouchers/my-wallet
Access: Protected (Customer Only)
Response (200 OK):
JSON
{
  "success": true,
  "vouchers": [
    {
      "voucherCode": "CAFE-AB12CD34",
      "isValid": true,
      "earnedAt": "2026-07-11T12:00:00.000Z"
    }
  ]
}
POST /api/admin/redeem-voucher
Access: Protected (Admin Only)
Request Body:
JSON
{
  "voucherCode": "CAFE-AB12CD34"
}
Response (200 OK):
JSON
{
  "success": true,
  "message": "Voucher successfully redeemed. Dispense free coffee reward."
}
