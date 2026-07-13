# Random ToDos that have accumlated 

This is a list of thoughts, issues, ammendments, alterations that have cropped up during the building of the requirements

## Functional
- [ ] Do we need the ability to re-draw mid competition? Keep all previous scores for completed rounds, then re-draw the remaining groups.
- [x] Auto-progresion through rounds/groups?
- [x] Add prep time, and 30second landing window time
- [x] Ability to fast-forward prep time
- [x] Ability to add time to prep time
- [x] CD needs to check scores for anomolies at the end before final report — captured as the CD end-of-contest validation pass gating Lock (2.2) plus manual entry/override (5.8) in high-level-requirements.md; see decisions.md D3
- [x] Need requirements for companion app - ensure we also add OIDC log-in against competitor list? to capture identity of changer — companion app drafted in docs/requirements/companion-app.md; identity of changer is captured in the MVP by an unauthenticated operator name-pick on companion clients (decisions.md D4, amended 2026-07-08); OIDC/authentication proper stays a Future Enhancement (conflicts with offline-first unless an IdP runs on the base)
- [ ] Manual lane adjustment after the draw (STORY-001-010): descoped from
  MVP. Trust the Contest Director to move pilots between lanes as a purely
  human/paper process (consistent with the existing "system failure → pen
  and paper" fallback) instead of a software-enforced adjust/clash-check
  feature. Analysis and REASONS Canvas were already produced and are kept
  for reference if this is revisited: `spdd/analysis/STORY-001-010-*.md`,
  `spdd/prompt/STORY-001-010-*.md`. Worth noting if picked up later: the
  canvas surfaced that lane adjustment can't be a naive single-pilot-move API
  — draw generation always fills every lane, so there's never a spare lane to
  move into; a real implementation needs either an atomic two-pilot swap
  operation or a generation-time "spare lane" concept.
- [ ] 
- [ ] 

## Non-Functional
- [x] Need a flexible domain model which can encode the specifics and variations of particular competions - espc in the scores/metrics recorded: some are multi-task where tasks require laps or time, or time and landing points, or time and launch height and landing points etc etc. This needs to be centralised such that there is one place which encodes these rules which drives what is displayed, what values are recorded, and how they are validated etc. — graduated to docs/requirements/non-functional.md NFR-1
- [x] Needs to be flexible enough to add new competition types without changing existing code - additive only. — graduated to docs/requirements/non-functional.md NFR-2
- [ ] 
- [ ] 
- [ ] 
- [ ] 
