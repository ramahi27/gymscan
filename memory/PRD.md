# GymScan – PRD

## Overview
Mobile fitness app where users photograph gym equipment and receive a personalized weekly workout plan built only around what's available. Target: travelers, hotel/building gym users, anyone with unfamiliar or limited equipment.

## Stack
- Frontend: React Native (Expo SDK 54), expo-router file-based routing
- Backend: FastAPI + MongoDB (motor)
- AI: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via Emergent Universal LLM key & `emergentintegrations` library
- Profile: Local single-device (no auth) — `user_id` cached in AsyncStorage

## Core Flows
1. Onboarding (name → goal → level → days/week) → creates `Profile`
2. Equipment Scanner (camera + gallery, up to 5 images) → Claude vision returns detected equipment JSON
3. Detection Confirmation (add / remove items manually)
4. Plan generation → Claude generates structured weekly split JSON
5. Active workout session with set/rep/weight logging + rest timer
6. Exercise detail screen with instructions

## Backend Endpoints
- `POST /api/profile`, `GET /api/profile/{id}`, `PUT /api/profile/{id}`
- `POST /api/scan` (vision detection from base64 images)
- `POST /api/plan`, `GET /api/plans/{user_id}`, `GET /api/plan/{plan_id}`
- `POST /api/session`, `GET /api/sessions/{user_id}`

## Data Models (MongoDB)
- `profiles`: id, name, goal, level, days_per_week, streak, is_pro, scans_used
- `scans`: id, user_id, detected_equipment[], created_at
- `plans`: id, user_id, scan_id, plan{split_name, days[]}, created_at
- `sessions`: id, user_id, plan_id, day_index, completed_exercises[], date

## Screens
Onboarding · Login (NEW) · Home · Scan · Confirm Equipment · Equipment Picker · Plan · Workout · Exercise Detail · Profile · Paywall

## Auth (v3)
- **Email/password JWT** auth on FastAPI: `POST /api/auth/signup`, `/api/auth/signin`, `GET /api/auth/me`, `POST /api/auth/logout`.
- **Emergent-managed Google Auth** via `/api/auth/google` (exchanges Emergent OAuth `session_token` for our session). Live in app — opens `auth.emergentagent.com`.
- **Apple / Facebook**: UI-only placeholders (require native build).
- **Forgot password**: `POST /api/auth/reset` is MOCKED — always returns 200, no email sent.
- **Token storage**: `expo-secure-store` on mobile, `localStorage` on web (key: `auth_token`).
- **When login is shown**: At the paywall moment (gating Pro upsell) and at app startup if a stored token is invalid/expired (logged-out returning user). Anonymous users can still onboard and use the app without an account.
- **Profile linkage**: Each authenticated user gets one MongoDB `Profile` (`auth_user_id` field linking them).
- New collections + indexes: `users` (unique `email`, `user_id`), `user_sessions` (unique `session_token`, TTL on `expires_at`).

## Feature additions (v2)
- **Exercise / equipment photos** — keyword-matched curated Unsplash thumbnails on plan exercise rows, workout exercise hero images, confirm-equipment rows, and equipment picker. Helper: `/app/frontend/src/utils/exerciseImages.ts`. Swap-in path for ExerciseDB RapidAPI available.
- **Smart weight & rep suggestions** — pre-filled per set based on profile level + goal (e.g. beginner+muscle_gain → 12-15 reps, advanced+muscle_gain → 4-6 reps, weight_loss → 15-20 reps + 30s rest, endurance → 20-30 reps + 20s rest). Helper: `/app/frontend/src/utils/suggestions.ts`. User can edit, add sets, delete sets. Session payload now distinguishes `suggested_*` vs `actual_*` values.
- **Searchable master equipment picker** — `/app/equipment-picker.tsx` with 6 categories (Cardio, Free Weights, Machines, Benches & Racks, Cables & Attachments, Bodyweight), search filter, multi-select, photo thumbnails. Replaces previous free-text manual entry. Catalog: `/app/frontend/src/utils/equipmentCatalog.ts`.

## Monetization (MOCKED)
Free vs Pro paywall UI only — no real billing wired (RevenueCat skipped per scope). `is_pro` flag exists on profile but is not toggled by purchase.

## Design
Dark theme (#0A0A0A), primary #6F61EF, secondary #39D2C0, Tactical Minimalist aesthetic, bottom tabs (Home, Scan, Plan, Profile).
