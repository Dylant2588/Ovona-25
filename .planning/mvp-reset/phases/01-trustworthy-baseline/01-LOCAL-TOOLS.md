# Portable local verification tools

Installed: 2026-10-29. User explicitly authorised installing the missing tools for a disposable local Supabase test environment. This document records tool installation only; no database test or migration execution is implied.

## Supabase CLI

- Executable: `C:\Users\u1434\AppData\Local\OvonaTools\supabase\supabase.exe`
- Verified command: `supabase.exe --version` returned `2.122.0` (exit 0).
- Source: official stable release metadata at `https://api.github.com/repos/supabase/cli/releases/latest`, tag `v2.122.0`, prerelease false.
- Archive: `https://github.com/supabase/cli/releases/download/v2.122.0/supabase_2.122.0_windows_amd64.zip`.
- Publisher manifest: `https://github.com/supabase/cli/releases/download/v2.122.0/checksums.txt`.
- Actual archive SHA-256 matched manifest: `60031FD5BF050FC12A0C6AEF68997600D143870F944BF13109C7765DCA329AF8`.

## PostgreSQL client

- Executable: `C:\Users\u1434\AppData\Local\OvonaTools\postgres\pgsql\bin\psql.exe`
- Verified command: `psql.exe --version` returned `psql (PostgreSQL) 17.11` (exit 0).
- Official PostgreSQL Windows download page links to EDB binary archives. EDB's current binary listing linked version 17.11 through `https://sbp.enterprisedb.com/getfile.jsp?fileid=1260616`, which resolved to the archive below.
- Archive: `https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip` (381,531,864 bytes).
- Publisher checksum: `https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip.sha256`.
- Actual archive SHA-256 matched publisher checksum: `80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F`.
- Extracted the archive's `pgsql/bin/` tools and companion DLLs only. No PostgreSQL server/service was installed, initialised or started. Only `psql --version` was executed.

## Boundaries

No persistent PATH changes, application dependency/package changes, project linking, live credentials, SQL execution, database connections, services or commits were introduced by this tool-installation work. Download archives and publisher checksum manifests remain under the task-specific `OvonaTools` directories for reproducibility. Docker/WSL installation and disposable-stack startup are handled separately by the parent task.

The integration harness can use the absolute `psql.exe` path as `OVONA_BASELINE_TEST_PSQL`. All other target guards and explicit disposable-environment requirements remain mandatory.
