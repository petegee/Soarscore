# Feature Parity — Soarscore vs GliderScore

A comparison between **Soarscore as defined** (requirements-stage design; no
implementation yet) and **[GliderScore](https://gliderscore.com/)**, a mature,
free Windows desktop application for RC glider competition management.
Compiled 2026-07-08 from a crawl of the GliderScore website (main menu,
setup, draw rounds, display/timer/audio, scoring, reports, online scores,
FAQ pages).

**Differences only.** Where the two systems match, features are omitted:
pilot and landing-table master data, man-on-man draws with anti-repeat
fairness checking and distribution metrics, lane allocation, drop-worst
rules, group-score normalisation, re-flights / group
moves / pilot retirement, outlier score validation, draw and results
reports, and blank scoring sheets are common to both.

## Architecture & score capture (the core divergence)

| Aspect | Soarscore (as defined) | GliderScore |
|---|---|---|
| Platform | Headless Base Station appliance; operator UIs via companion app | Windows PC application; operator at the keyboard |
| Primary capture | **Live concurrent capture** — one Scorer per competitor on a dedicated **ESP32 stopwatch handheld**; the device *is* the stopwatch | **Central manual keyboard entry** at the PC after flights; smart shorthand (630 → 6:30) |
| Electronic scoring | Core MVP, no BYOD | Optional **eScoring: pilots self-score on their own smartphones** via QR-coded cards, uploaded via internet to GliderScore's server (no direct PC↔phone link) |
| Who scores | Pilots **never** self-score (conflict of interest) | eScoring is pilot-submitted; scorekeeper downloads/verifies |
| Connectivity model | **Offline-first**; devices buffer & sync locally; no internet needed | Local entry offline, but eScoring and publishing **require internet** |
| Wrong-pilot guard | Pre-group pilot confirmation gate on each device, tied to the prep countdown | QR code binds card to pilot; downloaded scores can't overwrite manual entries |
| Auditability | **Immutable event log** of all mutations | "Lock Data" checkbox; no event log |
| Failure policy | Explicit pen-and-paper fallback + CD validation pass gating Lock | Backup/restore, backup-computer guidance; no formalised paper workflow |

## Running the field (Area 6)

| Aspect | Soarscore | GliderScore |
|---|---|---|
| Timer/board | Integrated wired board + speakers driven by the Base Station; **one shared clock also drives the Scorer devices** | PC "Digital Timer" + audio out; **third-party LED boards** (AerobTec, Embedded-Ability, Arduino boards) over USB/serial |
| Run control | Automatic phased sequence with **CD pause / fast-forward / add-time, prep confirmation gate, abort-and-restart group** | Timer plays configured timing sequences; no confirmation gating or completeness interlocks |
| Round progression | **Gated** — next round blocked until all scores captured and no-scores resolved | Ungated; operator-driven |
| Audio | TTS, **English only** | Pre-recorded .wav/.mp3, mic recordings, phonetic TTS files, **multi-language (Translate module)**, auto F3K/F5K task descriptions |
| No-score semantics | Explicit **no-score ≠ zero** state with auto-conversion at round end | Not modelled; zero or ignored-reflight (round 0) tricks |

## Scope & feature breadth (GliderScore has, Soarscore defers)

| Feature | Soarscore | GliderScore |
|---|---|---|
| Classes | 6 (F3B, F3J, F3K, F5J, F5K, F5L) | **14** (adds F3F, F3G, F3L, F3Q, F5B, Thermal, Electric, ALES) |
| Teams / team protection / team results | Future | Yes |
| Frequency management (20 kHz spacing, channels) | Future (2.4 GHz assumed) | Yes |
| Fly-offs & seeded draws (SMOM) | Future | Yes |
| Merge competitions / competition series | Future | Yes |
| Export/import (.zip), CSV pilot import | Future | Yes |
| Online publishing, live web results, email reports | Future (MVP: **local-Wi-Fi read-only page**) | Yes (public server, public/private, mid-round refresh) |
| PDF/CSV output, badges, matrix badges | Badges/exports future | Yes |
| Models, devices, roles, country codes master data | Future | Yes |
| Localization | English-only MVP | Multi-language |
| Backup/compact database utilities | Future | Yes |
| Helper assignment as a draw constraint | Waived (D1) — at club level the Scorer **is** the helper | Yes |

## Soarscore has, GliderScore lacks

| Feature | Notes |
|---|---|
| Contest templates | Reusable pre-configured setups (1.3); no GliderScore equivalent found |
| Suspend/resume as first-class state | Multi-day carry-over incl. mid-round suspend (2.3) |
| Lone-pilot dummy safeguard | Random dummy normalisation partner, F3B annul override (5.3) |
| Governed mid-contest config changes | CD authority, declared recompute scope, opt-in recompute (Area 3) |
| Penalty model as designed | Cumulative, aggregate-level, survives dropped rounds, logged (5.9) — GliderScore has per-task deductions + general penalties but no audit trail |
| Scorer correction window | Device edits bounded by next-group start (D11), then base-side administration (Area 5) |

## Takeaway

GliderScore is far broader (classes, teams, frequencies, series, publishing,
internationalisation) but is fundamentally an operator-at-a-PC transcription
tool with optional pilot self-scoring over the internet. Soarscore's
differentiation is entirely in the **field workflow**: dedicated live-capture
devices, one shared clock across board / audio / devices, completeness-gated
round progression, and audit-by-event-log — none of which GliderScore
attempts.
