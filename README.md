# Career-Ops

AI-assisted job search operating system for Mahesh Koduri.

## Philosophy: "AI evaluates, human decides"

- AI does: Scan 100+ jobs, evaluate fit (A-F framework), draft CVs, generate form answers, track everything
- You do: Decide which jobs are worth your time, submit applications, negotiate offers
- Strongly discourage applying below 4.0/5 scores

## Quick Start

```bash
# Evaluate single job
/career-ops oferta <job-url>

# Generate tailored CV
/career-ops pdf <job-report>

# Batch process URLs
/career-ops pipeline

# Scan portals for new jobs
/career-ops scan

# Get form-filling help
/career-ops apply <job-report>

# Check status
cat data/applications.md
```

## File Structure

- `cv.md` - Your master resume (single source of truth)
- `config/profile.yml` - Your rules and preferences
- `templates/` - LaTeX CV and cover letter templates
- `modes/` - AI instruction files (A-F framework)
- `data/` - Application tracker, pipeline, scan history
- `reports/` - Individual job evaluations
- `output/` - Generated PDFs

## Requirements

- Node.js (for PDF generation script)
- XeLaTeX (TeX Live or MiKTeX)
- profile photo as `templates/photo.jpg`

## CV Template Features

- Photo top-right (2.4cm)
- Location auto-matches job city
- Skills-first layout
- Impact bullets with metrics
- 1-page constraint
- German typography support

## Build Checklist

- [x] All directories created
- [x] `cv.md` populated with full profile
- [x] `config/profile.yml` with rules, salary targets, filters
- [x] `portals.yml` with 50+ companies and scan rules
- [x] `templates/cv-template.tex` (jobpack style with placeholders)
- [x] `templates/cover-template.tex` (matching style)
- [x] `templates/photo.jpg` placeholder
- [x] All 6 mode files with A-F framework
- [x] `data/applications.md` with CRM structure
- [x] `data/pipeline.md` and `data/scan-history.tsv` initialized
- [x] `tools/generate-latex-pdf.mjs` executable
- [x] `README.md` with documentation
- [x] `.gitignore` ignoring generated PDFs and reports

## Post-Build Instructions

1. Add your photo: `cp your-photo.jpg templates/photo.jpg`
2. Install XeLaTeX: TeX Live or MiKTeX
3. Test PDF generation: `node tools/generate-latex-pdf.mjs templates/cv-template.tex`
4. Initialize git: `cd ~/career-ops && git init && git add . && git commit -m "Initial career-ops setup"`
5. First run: `/career-ops scan` to populate pipeline

PHILOSOPHY: "AI evaluates, human decides" — AI does 80% (scan, evaluate, draft, track), human does 20% (decide, submit, negotiate). No spray-and-pray.
