# Gates: Timetable image importer

OWNS: app/admin/**, app/api/admin/**, components/Admin/**, lib/**, services/**, types/**, GATES.md

Scope: Add a protected timetable-image importer that extracts Gregorian-dated prayer start times, previews changes, and updates only start-time cells in the configured Google Sheet.

- [ ] G1: Automated extraction and sheet-row mapping tests pass
  CHECK: npm test -- --runInBand
  EXPECT: Tests:.*passed
  EVIDENCE: pending

- [ ] G2: The production application compiles with the importer routes and UI
  CHECK: npm run build -- --webpack
  EXPECT: Compiled successfully
  EVIDENCE: pending

- [x] G3: The importer never writes congregation/Jama'ah columns
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('services/TimetableImportService.ts','utf8'); if(/congregation_start.*update|update.*congregation_start/s.test(s)) process.exit(1); if(!s.includes('fajr_start')||!s.includes('isha_start')) process.exit(1); console.log('safe write columns verified')"
  EXPECT: safe write columns verified
  EVIDENCE: automatic-evidence=v1; definition-sha256=99a1d4ecf5e2bd5da39b10b0699d5bc212876687544159989d2e1636c2e3fad9; exit=0; EXPECT=matched; output-sha256=5766f6c04ac555f570ff9118ef509fead019ab3e9a9dce7438a61985c4c97ed4; output-bytes=28; shell=/bin/sh; cwd=/Users/anas/Documents/GitHub/Mosque-Prayer-Display-Screen; path=3e36984687bf/26 entries

- [ ] G4: Manual admin flow is protected and presents a review before saving
  EVIDENCE: pending
