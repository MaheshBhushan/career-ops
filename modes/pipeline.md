# PIPELINE MODE - Batch URL Processing

## Input: data/pipeline.md (list of URLs)
## Output: reports/ for each job

For each URL in data/pipeline.md:
1. Run OFERTA mode evaluation (Blocks A-F)
2. Write report to reports/XXX-company-role-date.md
3. Update data/applications.md tracker
4. If score >= 4.0:
   - Trigger auto-pipeline to generate PDF
   - Add "PDF: ✅" to tracker
5. If score 3.0-3.9:
   - Add to tracker with "Status: Review"
   - Flag for user decision
6. If score < 3.0:
   - Add to tracker with "Status: Rejected"
   - Log reason in Notes

De-duplication: Check scan-history.tsv for existing URLs.
