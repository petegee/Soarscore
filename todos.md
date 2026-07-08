# Random ToDos that have accumlated 

This is a list of thoughts, issues, ammendments, alterations that have cropped up during the building of the requirements

## Functional
- [ ] Do we need the ability to re-draw mid competition? Keep all previous scores for completed rounds, then re-draw the remaining groups.
- [x] Auto-progresion through rounds/groups?
- [x] Add prep time, and 30second landing window time
- [x] Ability to fast-forward prep time
- [x] Ability to add time to prep time
- [x] CD needs to check scores for anomolies at the end before final report — captured as the CD end-of-contest validation pass gating Lock (2.2) plus manual entry/override (5.8) in high-level-requirements.md; see decisions.md D3
- [x] Need requirements for companion app - ensure we also add OIDC log-in against competitor list? to capture identity of changer — identity capture is a recorded Future Enhancement; the event log carries an actor-identity field defaulting "unknown" in the MVP (decisions.md D4)
- [ ] 
- [ ] 
- [ ] 

## Non-Functional
- [x] Need a flexible domain model which can encode the specifics and variations of particular competions - espc in the scores/metrics recorded: some are multi-task where tasks require laps or time, or time and landing points, or time and launch height and landing points etc etc. This needs to be centralised such that there is one place which encodes these rules which drives what is displayed, what values are recorded, and how they are validated etc. — graduated to docs/requirements/non-functional.md NFR-1
- [x] Needs to be flexible enough to add new competition types without changing existing code - additive only. — graduated to docs/requirements/non-functional.md NFR-2
- [ ] 
- [ ] 
- [ ] 
- [ ] 
