# Privacy Policy

**Last updated:** 2026-05-26

This project is hosted as a static read-only portfolio dashboard.

## Telemetry & Data Collection
* **Anonymized Analytics:** Page views and repository clicks are logged in a Supabase backend database to compile traffic metrics.
* **IP Anonymization:** Client IP addresses are hashed immediately using a daily rotating salt secret (`SHA256(IP + salt + date)`). Plaintext IP addresses are never transmitted to or stored in the database.
* **Offline Caching:** Page view data is temporarily cached in your browser's local IndexedDB when offline and can be cleared at any time through browser settings.
