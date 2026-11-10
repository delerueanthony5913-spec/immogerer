# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite, port 5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
firebase deploy   # Deploy to Firebase Hosting (after build)
```

No test suite exists in this project.

## Architecture

**Cadel Manager** is a single-page rental property management app (PWA) for Anthony's rental business. It runs entirely in the browser — no backend server.

### Stack
- **Vite + React 18** (JSX, no TypeScript)
- **Firebase** (Firestore for data, anonymous Auth, Storage)
- **Google Calendar API** (via GIS client loaded in `index.html`)
- **Tailwind CSS** (via CDN in `index.html`, not PostCSS)
- **jsPDF** for lease/contract generation
- **lucide-react** for icons

### Data layer
All persistent data lives in Firestore under the path `artifacts/immogerer-prod-final/users/{uid}/`. Collections:
- `reservations` — rental bookings (guests, dates, amounts, expenses)
- `properties` — managed properties
- `chantiers` — renovation/works projects
- `settings` — single doc with platforms, providers, emails, fiscal params, etc.

The constant `appId = 'immogerer-prod-final'` (in `firebaseConfig.js`) is the Firestore path prefix. Firebase uses **anonymous auth** — the user is identified by their device's anonymous UID.

### Source files (`src/`)
| File | Role |
|---|---|
| `App.jsx` | Root component — all global state, Firestore subscriptions, modals, tabs |
| `firebaseConfig.js` | Firebase init; exports `auth`, `db`, `storage`, `appId` |
| `googleCalendar.js` | Google Calendar REST API calls; token stored in `localStorage` |
| `utils.js` | Shared constants (`CHART_COLORS`, `TIME_SLOTS`) and pure helpers (`formatDateFr`, `isSundayOrHoliday`) |
| `Statistiques.jsx` | Revenue/stats charts tab |
| `ComparisonChart.jsx` | Year-over-year bar chart |
| `DonutChart.jsx` | Donut chart component |
| `ReservationList.jsx` | Reservation list/table tab |
| `Finances.jsx` | Finances tab |
| `Agenda.jsx` | Calendar/planning view |
| `ContratModal.jsx` | Lease contract modal with PDF generation via jsPDF |
| `signature.js` | Signature/PDF helpers |

### Google Calendar integration
`googleCalendar.js` wraps the Calendar REST API. The OAuth token lives in `localStorage` (`gcal_token` / `gcal_token_expiry`). A background token renewal timer and a `visibilitychange` listener (re-authenticate when returning to tab on mobile) are managed in `App.jsx`.

**Dias** (a special service provider) has their own dedicated calendar (`diasCalendarId`) and separate CRUD functions (`createDiasEvent`, `updateDiasEvent`, `deleteDiasEvent`) — they are excluded from attendee email notifications.

### PIN lock
The app is protected by a local PIN (`cadel_unlocked` in `localStorage`). The PIN itself is stored hashed in Firestore under `settings`.

### Environment variables
Firebase config is read from Vite env vars (`VITE_FIREBASE_*`). Copy `.env.example` to `.env.local` if it exists, or set these vars before building.

### PWA
The app is configured as a PWA via `public/manifest.json` and `index.html` meta tags. Icons at `public/icon-192.png` and `public/icon-512.png`.
