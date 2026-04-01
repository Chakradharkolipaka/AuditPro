# React Frontend (`React-frontend`)

AuditPro dashboard app.

## Features

- Firebase Google OAuth sign-in
- Optional wallet connect/link
- Multi-language contract upload UX
- Async audit progress + card-based report display
- History filtering (language/protocol/date) and risk-score sorting

## Environment

Create `.env` (or use root `.env.local` mirrored into Vercel):

```text
REACT_APP_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:5000

REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
```

## Scripts

```bash
npm start
npm run build
npm test
```

## Notes

- API error responses use structured `{ code, message }` format.
- Dashboard uses server-side history filters by query params.
