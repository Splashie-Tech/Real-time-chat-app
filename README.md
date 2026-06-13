# Production-Grade Real-Time Chat Application

A complete full-stack real-time chat workspace featuring persistent chat rooms, cryptographic token authorization, typing indicators, and a responsive frontend interface.

##  Architecture Design Overview

The application utilizes a decoupled client-server architecture model structured inside a unified repository setup:

- **Backend Architecture (`server/`):** - **Runtime Framework:** Node.js paired with Express.
  - **Database Persistence:** MongoDB managed seamlessly via Mongoose ODM schemas.
  - **Authentication Mechanism:** State-free JSON Web Tokens (JWT) issued on login/registration routes. Passwords are safe-hashed using `bcrypt` pre-save model hooks.
  - **Real-Time Engine:** Socket.io server integrated over an HTTP layer, enforcing strict JWT validation middleware before approving connection handle attachments.

- **Frontend Architecture (`client/`):**
  - **Framework Layout:** React (bootstrapped with Vite) utilizing declarative state tracking.
  - **Styling Architecture:** Tailwind CSS providing a utility-first dark mode layout.
  - **Real-Time Client:** `socket.io-client` managing the continuous full-duplex background communication socket bridge.

---

##  Socket.io Event Documentation

### Inbound Handshakes & Events (Client ➡️ Server)

#### 1. Connection Header Authorization Handshake
- **Trigger:** On initialization of the application if a token exists in local storage.
- **Payload Structure:** Passes a verification token via handshake auth objects:
  ```json
  { "auth": { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." } }