# Fret Theory — Complete Product Plan

## App Overview

A guitar theory learning tool focused on fretboard visualisation, chord voicing exploration (Root Position, Drop 2, Drop 3), and spaced repetition quizzes. Designed as a web app with a future Swift/iOS rewrite.

**Domain:** frettheory.app

---

## Current Features (Shipped)

### Fretboard Visualiser
- Interactive fretboard display with all notes across 6 strings and 15 frets
- Real-time note highlighting based on selected scale/chord
- Click to activate/deactivate notes
- Resize handle (drag to resize, double-click to reset, persists to localStorage)

### Scale & Mode Selector
- 21+ scales/modes: Major, Natural Minor, Harmonic Minor, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian, and more
- Key selection across all 12 chromatic notes
- Click pills for inline editing, press `K` for Key Viewer modal
- Key Viewer: root note dropdown, family filters, text search with autocomplete, scrollable results with tension labels
- Persists root/name to localStorage

### Diatonic 7th Chord Engine
- Automatically generates all diatonic 7th chords for the selected scale
- Displays chord quality (Maj7, Min7, Dom7, Min7♭5, Dim7, etc.)
- Maps chords to their scale degree (I, ii, iii, IV, V, vi, vii°)

### Chord Voicing Directory
- Root Position voicings
- Drop 2 voicings
- Drop 3 voicings
- Voicings displayed across multiple string sets
- Visual fretboard mapping for each voicing
- Hover previews voicings on fretboard (blue highlight)
- Click peek icon to lock voicing on fretboard
- 3-tab interface (Root Pos / Drop 2 / Drop 3)

### Controls & Keyboard Shortcuts
- Info toggle (show/hide note text)
- Note Names / Degree display toggle
- `K` — Key Viewer modal
- `P` — Scale peek mode (all in-scale notes glow at 40% opacity, double-tap locks)
- `N` — Toggle note names / degree
- `C` — Clear all selected notes

### Architecture
- Vanilla Web Components (Custom Elements v1) with Shadow DOM
- No framework — each component is a class extending HTMLElement
- Template singleton caching (fetched once, cloned per instance)
- Components communicate via document-level CustomEvent dispatches (pub/sub)
- No build system — pure vanilla HTML/JS
- localStorage persistence for toggles, scale, fretboard size

---

## Navigation & Layout

### Top Bar (persistent on all pages)
- Hamburger menu icon (☰) — opens sidebar
- Breadcrumb trail — shows navigation path
- Quick action icons: Save (⭐), Settings (⚙), Home (🏠)

### Sidebar (collapsible hamburger menu)
- Slides out from hamburger icon
- Contains:
  - 🏠 Home
  - 🎸 Fretboard
  - 🧠 Quiz
  - 🎬 Practice (Phase 1.5)
  - 📚 Library
  - ⚙ Settings
  - Streak counter (e.g. "Streak: 7 🔥")
  - Next review countdown (e.g. "Next Review in 2h 14m")

---

## Pages

### 1. Home (Dashboard)

**Route:** `/` or `/home`
**Purpose:** Daily overview — what to practice today, quick stats, fast access to everything.

**Content:**
- **Daily Review Banner** — number of voicings due for spaced repetition review, CTA to start quiz
- **Streak Counter** — current streak, best streak
- **Quick Stats** — voicings saved, quizzes completed, overall mastery percentage
- **Recent Saves** — last 3-5 saved items from library (tap to open on fretboard)
- **Quick Launch Grid** — 4 buttons: Open Fretboard, Start Quiz, Browse Library, Settings

**Links to:** Fretboard, Quiz, Library, Settings

---

### 2. Fretboard (Main Tool)

**Route:** `/fretboard`
**Purpose:** The existing core app — fretboard visualiser, scale selector, chord directory. Current main.html content, now as a page within the larger app.

**Layout:**
- Control bar: Info toggle, Name/Degree toggle, Scale selector
- Fretboard neck (15 frets, 6 strings, interactive notes)
- Bottom panel split: Chord Directory (left) + Notes Panel (right)

**New additions to existing page:**
- **Save Button (⭐) in top bar** — save current fretboard state (selected notes, scale, voicing) to library
- **Save Icon (⭐) per voicing row** — save individual voicing to library
- **Notes Panel** — beside chord directory, a collapsible text area to add personal notes/annotations to the currently viewed chord/voicing
- **Breadcrumb** in top bar showing navigation path

**Existing features unchanged:**
- Fretboard neck with interactive notes
- Scale selector (click pills + K key viewer)
- Chord directory (Root Pos / Drop 2 / Drop 3 tabs)
- Voicing hover preview and peek
- Toggle controls (Info, Note Names/Degree)
- Keyboard shortcuts (K, P, N, C)
- Resize handle

**Links to:** Home (breadcrumb), Library (via save), Quiz (via sidebar)

---

### 3. Quiz

**Route:** `/quiz`
**Purpose:** Spaced repetition quiz engine. Tests recall of saved voicings and scale knowledge.

#### 3a. Quiz Landing

**Content:**
- **Daily Review Summary** — items due from spaced repetition schedule, estimated time
- **Practice Mode Selection** — 3 quiz modes:
  - Name the Chord — see a fretboard voicing, name the chord
  - Find the Voicing — given a chord name, find it on the fretboard
  - Identify the Degree — name the scale degree of a note/chord
- **Quiz Stats** — cards in mastered/learning/new buckets, accuracy history, last session score

#### 3b. Quiz Session (Active)

**Content:**
- Card counter (e.g. "Card 3 of 5")
- Timer (optional, configurable in settings)
- Question area with mini fretboard
- Multiple choice answers (4 options) or interactive fretboard for application questions
- Progress bar

**After correct answer:**
- ✅ confirmation
- Shows voicing on fretboard
- Displays user's personal notes if they exist for that item
- Next button

**After incorrect answer:**
- ✕ with correct answer shown
- Explanation (chord tones, inversion, etc.)
- Fretboard showing correct voicing
- "Add to Notes" option
- "Got it" + Next button
- **Card enters 10-minute retry loop** (see Retry Loop section)

#### 3c. Quiz Results

**Content:**
- Score (e.g. 4/5, 80%)
- List of all cards: ✅ correct / ✕ incorrect
- "Practice on Fretboard" link for missed items
- Updated streak counter
- Next review forecast (e.g. "6 items tomorrow")
- Buttons: Back to Dashboard, Quiz Again

**Links to:** Home (dashboard), Fretboard (practice missed items), Library

---

### 4. Library

**Route:** `/library`
**Purpose:** Browse, search, filter, and manage all saved voicings, scales, notes, and practice sessions.

#### 4a. Library Full Page

**Content:**
- **Search** — text search across chord names, keys, notes
- **Filters** — by type (voicing / scale / practice session), key, voicing type (Root/Drop 2/Drop 3), mastery status
- **Sort** — recently saved, alphabetical, mastery level, next review due
- **Each saved item shows:**
  - Chord/scale name
  - Voicing type and string set
  - Key context
  - Personal notes (preview)
  - Spaced repetition status (Mastered ✅, Learning 🟡, New)
  - Next review time
- **Actions per item:** Open on fretboard, edit/add note, delete

**Links to:** Fretboard (open saved item), Quiz (review due items), Home

#### 4b. Library Sidebar Panel (Quick Access)

- Accessible from **any page** via a keyboard shortcut or sidebar
- Lightweight slide-out panel showing last 5-10 saved items
- Tap to load onto fretboard (if on fretboard page) or navigate to fretboard
- "View All" links to full Library page

---

### 5. Settings

**Route:** `/settings`
**Purpose:** App preferences, quiz configuration, data management.

**Sections:**
- **Fretboard:** Number of frets, default tuning, default key
- **Quiz:** Daily reminder on/off, reminder time, cards per session, show timer on/off
- **Display:** Theme (dark), default note display (Note Names / Degree)
- **Devices:** iPhone sync setup, last synced, sync method (Phase 1.5+)
- **Data:** Export library (JSON), import library, clear all data (reset)
- **About:** Version, frettheory.app link

---

## Quiz Question Types

### Phase A — Recognition (Easy)

**A1. Name the Chord**
- Shown a voicing on a fretboard diagram
- Pick the correct chord name from 4 options

**A2. Name the Voicing Type**
- Shown a chord they know
- Identify whether it's Root Position, Drop 2, or Drop 3

**A3. Name the Inversion**
- Given chord name and voicing type
- Identify which inversion (Root, 1st, 2nd, 3rd) based on the bass note

### Phase B — Knowledge (Medium)

**B1. Identify the Chord Tones / Tensions**
- Given a chord name
- Tap all the correct chord tones (multi-select)
- Wrong selections highlighted in red, correct in green

**B2. What's the Function?**
- Given a key and a chord
- Identify the scale degree / harmonic function (I, ii, iii, IV, etc.)

**B3. Identify the Interval**
- Two notes shown on fretboard
- Identify the interval between them (m3, M3, P4, P5, etc.)

**B4. Which Scale Contains This Chord?**
- Given a chord
- Identify which scale/mode it's diatonic to

**B5. What Resolves Where?**
- Given a chord and key
- Identify the resolution target

### Phase C — Application (Hard, Interactive Fretboard)

**C1. Find the Voicing**
- Given a specific chord, voicing type, inversion, and string set
- User taps 4 notes on an interactive fretboard
- Feedback: correct notes green, wrong red, missed shown as outlines

**C2. Tap the Tension**
- A voicing is shown on the fretboard
- User taps the specific chord tone asked for (root, 3rd, 5th, 7th)

**C3. Complete the Voicing**
- 3 of 4 chord tones shown on fretboard
- User taps where the missing note goes

**C4. Find the Scale Position**
- Given a scale and position number
- User taps the correct root note on the fretboard

### Mastery Progression Per Saved Item

Each saved voicing/scale progresses through question types as mastery increases:

```
Save → A1 (name it) → A2 (voicing type) → B1 (chord tones) → B2 (function) → C2 (tap tensions) → C1 (build from scratch) → MASTERED
```

If they get any level wrong → 10-minute retry loop kicks in for that specific question type.

### Question Mixing in Sessions

| Card Mastery Level | Question Type Priority |
|---|---|
| New (just saved) | A1, A2 — basic recognition first |
| Learning (seen a few times) | B1, B2, B4 — theory knowledge |
| Familiar (getting it right) | A3, B3, B5 — deeper understanding |
| Strong (mostly mastered) | C1, C2, C3 — application on fretboard |
| Mastered (long intervals) | C1, C4, B5 — hardest types to maintain recall |

---

## Incorrect Answer Retry Loop

When a user gets a quiz question wrong:

1. **Immediate** — correct answer shown with explanation in the quiz session
2. **10 minutes later** — push notification / toast: "Quick retry? You missed Dm7 Drop 2"
3. **10 minutes later** — another notification if still wrong
4. **After 3rd miss** — interval backs off to 30 minutes
5. **After 4th miss** — interval caps at 1 hour
6. **Max 3 retry notifications per card per day** to avoid frustration
7. **"Later" on a notification** pushes retry back 30 minutes
8. **Once correct** — card resets to shortest normal SRS interval (1 day)

### On Desktop (web app)
- Small toast notification in the corner of whatever page they're on
- Tapping opens a single-card inline quiz without leaving the current page

### On iPhone
- Push notification: "Remember this one? You missed Dm7 Drop 2 earlier. Quick retry?"
- Tapping "Try Again" opens a single-card quiz — 10 seconds and done

### Retry cards always take priority over normal review cards in any session

---

## iPhone Micro-Quiz (Cross-Device)

### Concept
- Desktop: full fretboard tool — study, save voicings, deep practice sessions
- iPhone: bite-sized 30-second quizzes (3 cards) that pull from the saved library
- Synced so both devices share the same library and spaced repetition schedule

### Session Format
- 3 cards, ~30 seconds total
- Multiple choice answers
- Triggered by push notifications throughout the day
- Progress bar and card counter

### Sync Strategy (Phase 1 — local storage)
- Desktop exports library as JSON blob
- User scans QR code or taps "Send to Phone" link
- iPhone app imports it

### Sync Strategy (Future — Swift rewrite)
- iCloud CloudKit for automatic sync — no accounts, no backend
- Apple handles everything

---

## Practice Player (Phase 1.5)

### Concept
A dedicated page where a user pastes any YouTube URL (lesson, backing track, tutorial) and gets a practice workspace around it — with timestamped bookmarks, notes, and chord/scale tagging.

**Route:** `/practice`

### Features

#### Video Player
- Embedded YouTube iframe
- Speed control: 0.5x, 0.75x, 1x, 1.25x, 1.5x
- A-B loop: set two timestamps, loop between them (Phase 2)
- Quick rewind: tap to jump back 5 seconds
- "Add Bookmark" button capturing current timestamp

#### Bookmark System
- Pin current timestamp with one tap
- Each bookmark gets:
  - Timestamp (auto-captured)
  - Text note (free text)
  - Optional chord/scale tag (from library or typed)
- Tap any bookmark to jump to that point in the video
- Bookmarks displayed as a vertical timeline alongside video
- Saved to library alongside the video URL

#### Session Notes
- Free text area for general notes about the whole video
- Persists with the saved practice session

#### Saving
- Save entire practice session (URL + bookmarks + notes) to Library
- Shows in Library as a "Practice Session" type

### Connections
| Flow | Description |
|---|---|
| Library → Practice | Open a saved practice session, video loads with all bookmarks intact |
| Practice → Library | Save session to library |
| Practice → Fretboard | Tap a chord tag on a bookmark → opens fretboard with that voicing loaded |
| Fretboard → Practice | "Practice with backing track" button → opens Practice Player |
| Home → Practice | Recent practice sessions on dashboard, tap to resume |

---

## Page Interconnection Map

```
                    ┌──────────┐
                    │   HOME   │
                    │(Dashboard)│
                    └────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
 ┌──────────┐     ┌──────────┐     ┌──────────┐
 │FRETBOARD │     │   QUIZ   │     │ LIBRARY  │
 │(Main Tool)│     │(Landing) │     │          │
 └────┬─────┘     └────┬─────┘     └────┬─────┘
      │                │                 │
      │                ▼                 ▼
      │          ┌──────────┐    ┌──────────────┐
      │          │  QUIZ    │    │  PRACTICE    │ (Phase 1.5)
      │          │ SESSION  │    │  PLAYER      │
      │          └────┬─────┘    └──────────────┘
      │                │
      │                ▼
      │          ┌──────────┐
      │          │  QUIZ    │
      │          │ RESULTS  │
      │          └──────────┘
      │
      ◄──────────────────────────────────►
      (Open saved item on fretboard)
      (Save voicing from fretboard to library)

 ┌──────────┐
 │ SETTINGS │  ← accessible from any page via top bar
 └──────────┘

 ┌──────────────┐
 │LIBRARY PANEL │  ← slide-out sidebar, accessible from any page
 │(Quick Access) │
 └──────────────┘
```

### Navigation Flows

| From | To | Trigger |
|---|---|---|
| Any page | Home | Click 🏠 in top bar or sidebar |
| Any page | Settings | Click ⚙ in top bar |
| Any page | Library Panel | Keyboard shortcut or sidebar quick access |
| Home | Fretboard | "Open Fretboard" button or recent save tap |
| Home | Quiz | "Start Daily Quiz" banner or quick launch |
| Home | Library | "View Library" link or quick launch |
| Fretboard | Library | ⭐ Save button (saves + optional sidebar panel opens) |
| Library | Fretboard | "Open" on any saved item (loads voicing onto fretboard) |
| Library | Practice | "Open" on any saved practice session |
| Quiz Landing | Quiz Session | "Start Review" or select practice mode |
| Quiz Session | Quiz Results | Complete all cards |
| Quiz Results | Home | "Back to Dashboard" |
| Quiz Results | Fretboard | "Practice on Fretboard" for missed items |
| Quiz Results | Quiz Session | "Quiz Again" |
| Practice | Library | Save session |
| Practice | Fretboard | Tap chord tag on bookmark |

---

## Data Storage (localStorage)

All Phase 1 data lives in localStorage — no backend, no accounts.

```
frettheory_library       → Array of saved items {
                             id, type (voicing|scale|practice),
                             name, key, scale, voicingType, stringSet, inversion,
                             notes (user text), tags, savedAt, fretboardState
                           }

frettheory_quiz_history  → Array of quiz sessions {
                             date, score, totalCards, items: [{id, questionType, correct}]
                           }

frettheory_srs_schedule  → Object mapping item IDs → {
                             nextReview (ISO date),
                             interval (minutes),
                             status (new|learning|retry|familiar|strong|mastered),
                             retryCount,
                             failedAt,
                             masteryLevel (0-6, maps to question type progression),
                             questionHistory: {
                               A1: {correct, wrong, lastAsked},
                               A2: ..., B1: ..., etc.
                             }
                           }

frettheory_streak        → { current, best, lastDate }

frettheory_settings      → {
                             frets, defaultTuning, defaultKey,
                             reminderEnabled, reminderTime, cardsPerSession,
                             showTimer, theme, defaultNoteDisplay
                           }

frettheory_stats         → { totalQuizzes, totalSaved, totalCorrect, totalWrong }
```

---

## Phase Summary

| Phase | Features | Status |
|---|---|---|
| Current | Fretboard visualiser, scale selector, chord voicing directory | ✅ Shipped |
| Phase 1 | Home dashboard, quiz system (10 question types), spaced repetition, note-taking, personal library, settings, top bar + sidebar nav, save system, progress tracking, streak mechanics, 10-min retry loop | 🔨 To build |
| Phase 1.5 | Practice Player (YouTube embed + bookmarks + timestamps + notes), iPhone micro-quiz (cross-device sync) | 📋 Planned |
| Phase 2+ | Beginner features, multi-instrument, ear training, general theory tools, B2B/education | 📋 Future |

---

## Monetisation

### Free Tier
- Fretboard visualiser (all keys and scales)
- Diatonic 7th chord display
- Limited daily quizzes (3 per day)
- Basic scale library
- One instrument (guitar)

### Pro Tier ($4.99-9.99/mo or $39.99-79.99/yr)
- Unlimited quizzes and spaced repetition
- Full voicing directory (Root, Drop 2, Drop 3)
- Personal note-taking library (unlimited saves)
- Progress tracking and streak mechanics
- iPhone micro-quiz sync
- Practice Player (Phase 1.5)
- All instruments (future)
- Alternative tunings (future)
- Offline access
- No ads

### Teacher Tier ($14.99/mo) — Future
- Everything in Pro
- Teacher dashboard
- Custom quiz deck creation
- Student progress monitoring

### School Licence ($50-200/yr per seat) — Future
- Everything in Teacher
- Bulk student management, admin analytics, curriculum tools
