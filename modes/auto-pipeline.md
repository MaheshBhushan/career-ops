# AUTO-PIPELINE MODE - Eval to PDF

## Input: Job URL or report file
## Output: Report + PDF in output/

Steps:
1. If URL provided: fetch JD via browser, run OFERTA
   If report provided: load existing evaluation
2. Read cv.md master resume
3. Read config/profile.yml for rules
4. Generate tailored content:
   - Inject Block E tailored summary
   - Select top 3 projects matching JD
   - Fill {{LOCATION}} with job city
   - Fill {{TARGET_ROLE}} with job title
5. Populate templates/cv-template.tex with data
6. Run tools/generate-latex-pdf.mjs
7. Copy PDF to output/cv-{company}-{role}-{date}.pdf
8. Update data/applications.md with PDF link and "Status: Evaluated"
