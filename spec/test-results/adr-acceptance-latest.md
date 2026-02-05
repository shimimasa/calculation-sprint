# ADR Acceptance Checklist (Manual Runner)
- Timestamp: 2026-02-05T04:32:06.760Z
- Overall: PASS

## Checks
- [PASS] S1 ADR-004 CSS selectors are fully scoped under .calc-sprint
- [PASS] S2 ADR-004 index.html references scoped CSS only
- [PASS] M1 Root server responds with 200
- [PASS] M2 Subpath server responds with 200
- [PASS] M3 Profile storage keys are separated
- [PASS] M4 Profile reset clears only targeted keys
- [PASS] M5 ADR-001 unlocks next stage only after result (markCleared)

## Evidence
### S1 ADR-004 CSS selectors are fully scoped under .calc-sprint
Status: PASS

All selector lines are scoped under .calc-sprint.

### S2 ADR-004 index.html references scoped CSS only
Status: PASS

index.html references styles/style.scoped.css: YES
index.html references styles/style.css: NO
index.html references styles/legacy/style.css: NO

Rule: index.html must reference styles/style.scoped.css and must not reference styles/style.css.

### M1 Root server responds with 200
Status: PASS

curl http://127.0.0.1:8082/ returned 200.

### M2 Subpath server responds with 200
Status: PASS

curl http://127.0.0.1:8083/calculation-sprint/ returned 200.

### M3 Profile storage keys are separated
Status: PASS

daily keys: portal.calcSprint.daily.v1.p:A | portal.calcSprint.daily.v1.p:B
rank keys: portal.calcSprint.rank.distance.today.v1.p:A | portal.calcSprint.rank.distance.today.v1.p:B
stage keys: portal.calcSprint.stageProgress.v1.p:A | portal.calcSprint.stageProgress.v1.p:B
daily(A): {"2099-01-01":{"bestAvgSec":2.3,"bestDistanceM":5,"attemptTotal":3,"wrongTotal":1,"wrongByMode":{"add":0,"sub":0,"mul":0,"div":0},"sessions":1}}
daily(B): {"2099-01-01":{"bestAvgSec":1.8,"bestDistanceM":9,"attemptTotal":5,"wrongTotal":0,"wrongByMode":{"add":0,"sub":0,"mul":0,"div":0},"sessions":1}}
rank(A): {"dateKey":"2099-01-01","top":[12.3]}
rank(B): {"dateKey":"2099-01-01","top":[8.8]}

### M4 Profile reset clears only targeted keys
Status: PASS

after reset A daily: null
after reset A rank: null
after reset A stage: null
remaining B daily: {"2099-01-01":{"bestAvgSec":1.8,"bestDistanceM":9,"attemptTotal":5,"wrongTotal":0,"wrongByMode":{"add":0,"sub":0,"mul":0,"div":0},"sessions":1}}
remaining B rank: {"dateKey":"2099-01-01","top":[8.8]}
remaining B stage: {"clearedStageIds":["w1-1"],"lastPlayedStageId":"w1-1","updatedAt":"2026-02-05T04:32:06.760Z"}

### M5 ADR-001 unlocks next stage only after result (markCleared)
Status: PASS

before markCleared -> next unlocked: false
after markCleared -> next unlocked: true

## Call Log
- curl http://127.0.0.1:8082/ -> 200
- curl http://127.0.0.1:8083/calculation-sprint/ -> 200
- dailyStatsStore.upsert(A/B), todayRankStore.update(A/B), stageProgressStore.markCleared(A/B)
- resetProfileData(A)
- stageProgressStore.setLastPlayed(w1-1, C)
- stageProgressStore.markCleared(w1-1, C)
