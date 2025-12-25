@echo off
set DATABASE_URL=postgresql://vmcandle_user:pMhsiAYzBmTWaKW9TWUZTeaYT2osYRn5@dpg-d4ueq9emcj7s73d39srg-a.virginia-postgres.render.com/vmcandle
node scripts/seed-production.js
