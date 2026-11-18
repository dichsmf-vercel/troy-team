# Troy Team — manual QA test plan

Run against production (`https://troy-coach-ahmed.vercel.app`) in a browser. Everything created during QA is
named with a `QA` / `Claude` prefix so it can be deleted before launch. Results go in `docs/qa/results-<date>.md`.

Legend: **[EN]** run in English, **[AR]** run in Arabic (also check RTL alignment and untranslated text).

## 0. Setup
- Admin signed in. Test athlete account **"Claude QA Tester"** created from the admin form (fake data).
- Untranslated-text check on every screen in Arabic: collect visible text and flag Latin words that are not
  brand names, codes or data (Troy, TROY-…, FMS, RPE, GK/RB, emails, URLs, numbers, units).

## 1. Public pages [EN][AR]
| # | Step | Expected |
|---|------|----------|
| 1.1 | Open `/auth/login`, toggle language | All labels switch, layout flips to RTL, font changes (Jakarta / Cairo) |
| 1.2 | `/parent` with an invalid code | Clear "invalid or expired" error, no crash |
| 1.3 | `/legal` | All 5 sections render, translated in AR |
| 1.4 | `/auth/callback?next=//evil.com` | Redirects to `/auth/set-password`, never off-site |
| 1.5 | Protected URL while signed out (`/admin`, `/dashboard`) | Redirect to `/auth/login` |

## 2. Admin — athletes [EN][AR]
| # | Step | Expected |
|---|------|----------|
| 2.1 | Open `/admin`, every tab (Athletes, Sessions, Programs, Exercises, Rules, Feedback) | Each renders without errors |
| 2.2 | Roster: search by name / Troy ID, filters (All, Active, Paused, Pain, Selfies) | Counts and results match |
| 2.3 | Create athlete "Claude QA Tester" with sport, position, days, measurements, FMS, performance, strength | Troy ID + temp password shown once; athlete appears in roster |
| 2.4 | Open athlete drawer | Profile, measurements, FMS/RAG, settings, selfies, feedback, controls render |
| 2.5 | Drawer settings: change training days, program mode, save | "Settings saved" and values persist after reload |
| 2.6 | Generate temporary password (test athlete only) | New password shown, `password_change_required` set |
| 2.7 | Pause → resume (test athlete only) | Status toggles, roster count changes |
| 2.8 | `/admin/athletes/[id]` page: edit and save account | Saves; values persist |

## 3. Admin — bulk import [EN][AR]
| # | Step | Expected |
|---|------|----------|
| 3.1 | "Import from Excel" opens the dialog with the template table | Columns match the measurement sheet |
| 3.2 | Download template | `.xlsx` with Athletes / Example / Instructions |
| 3.3 | Choose `قياسات اللعيبه الغابه.xlsx` | 83 rows previewed, English names + Arabic under them, no row errors |
| 3.4 | Import | Progress shown, credentials table + CSV download, teams created with EN/AR names |
| 3.5 | Import the same file again | Every row skipped as existing, no new accounts |
| 3.6 | Imported athlete drawer | FMS / tests / club / sport / position stored correctly |

## 4. Admin — content [EN][AR]
| # | Step | Expected |
|---|------|----------|
| 4.1 | Teams: create "QA Team" | Appears in the list and in team pickers |
| 4.2 | Exercises: add "QA Exercise", save a YouTube link; invalid link rejected | Saved / clear error |
| 4.3 | Sessions: create a session for the test athlete with 2–3 exercises, reorder, save; delete a second QA session | Listed with date/time; delete asks to confirm |
| 4.4 | Programs (rules engine): preview month for test athlete, save draft | Draft appears in "awaiting review" |
| 4.5 | Programs (AI): generate for test athlete | Program within ~60 s or a clear error; fallback button works |
| 4.6 | Edit an AI exercise + reason, save | Saved; prompt proposal appears for admin approval |
| 4.7 | Review panel: approve the test program | Status changes; athlete can see it |
| 4.8 | Rules: search, add a manual QA rule | Rule listed (do NOT run "Import CSV rules": it replaces all rules) |
| 4.9 | Feedback tab | Renders; empty state when no data |

## 5. Athlete — test account [EN][AR]
| # | Step | Expected |
|---|------|----------|
| 5.1 | First login with Troy ID + temp password | Forced to `/auth/set-password` |
| 5.2 | Dashboard | Today's training, assigned sessions, program status |
| 5.3 | Assigned session: start, complete exercises, upload a selfie, report pain, finish, summary form | Each step saves; summary redirects to dashboard |
| 5.4 | Program page + program session runner | Calendar, sessions, recap, feedback |
| 5.5 | Progress, Profile (parent access ID), Assessment (submit + image), Intake | Pages render and save |
| 5.6 | Admin side afterwards | Selfie, pain report and summary visible in drawer / feedback |

## 6. Cross-cutting
- Mobile width (375 px): login, dashboard, session runner, admin roster, import dialog.
- Arabic: no English UI text, correct RTL, Arabic names/teams shown where available, dates localized.
- No console errors on each screen.
