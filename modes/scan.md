# SCAN MODE - Portal Discovery

## Input: portals.yml
## Output: data/scan-history.tsv

For each company in portals.yml where enabled: true:
1. Use Playwright to visit careers_url
2. Extract job listings:
   - Title
   - URL
   - Location
   - Posted date (if available)
3. Filter by title_filter positive/negative from profile.yml
4. Filter by location (match against profile.yml location_preferences)
5. Check data/applications.md for duplicates (URL + title hash)
6. Write new jobs to data/scan-history.tsv:

Date | Company | Title | Location | URL | Match Score | Status

7. For high-fit roles (title matches + location matches):
- Add to data/pipeline.md
- Trigger auto-pipeline if score > 4.0

Rate limiting: Max 20 requests/hour to avoid IP bans.
