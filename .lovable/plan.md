

## Problem

Die App prüft an mehreren Stellen ob ein User eingeloggt ist (`supabase.auth.getSession()`), bietet aber keine Möglichkeit sich anzumelden. Es fehlt eine Auth-Seite komplett.

## Lösung: Auth-Seite mit Email/Password Login + Signup

### Was gebaut wird

1. **`src/pages/Auth.tsx`** — Eine einzelne Seite mit Login/Signup-Tabs:
   - Email + Passwort Login
   - Email + Passwort Signup
   - Passwort-Reset-Link (öffnet Reset-Flow)
   - Redirect nach `/dashboard` bei erfolgreichem Login

2. **`src/pages/ResetPassword.tsx`** — Seite zum Setzen eines neuen Passworts nach Reset-Link

3. **`src/hooks/useAuth.ts`** — Hook für Auth-State (session, user, loading) mit `onAuthStateChange` Listener

4. **Route-Protection** in `App.tsx`:
   - `/auth` — öffentlich (Login/Signup)
   - `/reset-password` — öffentlich
   - Alle anderen Routen → Redirect zu `/auth` wenn nicht eingeloggt
   - `/` → Redirect zu `/dashboard` (statt `/onboarding`) wenn eingeloggt

5. **AppSidebar** — Logout-Button im Footer + User-Email anzeigen

### Kein Profil-Table nötig

Die App nutzt bereits `athlete_connections` mit `user_id` Referenz. Kein separater `profiles`-Table erforderlich — die Auth-Daten aus `auth.users` reichen aus.

### Technische Details

- Supabase Auth mit `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`
- `onAuthStateChange` wird VOR `getSession` registriert (Supabase Best Practice)
- Email-Redirect-URL: `window.location.origin` für Signup-Bestätigung
- Reset-Redirect: `window.location.origin/reset-password`
- Design: Zentrierte Card wie Onboarding-Seite, mit Bike-Icon und "VeloCoach AI" Branding

