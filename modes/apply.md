# APPLY MODE - Form Assistance

## Input: Job report + form screenshot
## Output: Tailored answers for copy-paste

Do NOT auto-submit (ATS vary, CAPTCHAs exist).

Process:
1. Analyze form screenshot, identify all fields
2. Load job report from reports/
3. Generate answers using Block F STAR stories:

## Responses for {{COMPANY}} — {{ROLE}}

### "Why are you interested in this role?"
> {{TAILORED_RESPONSE_USING_BLOCK_E}}

### "Tell us about a challenging project"
> {{STAR_STORY_FinanRAG}}

### "Describe your experience with {{TECH_FROM_JD}}"
> {{RELEVANT_EXPERIENCE_FROM_CV}}

### "How do you handle tight deadlines?"
> {{STAR_STORY_PEOPLE_TECH}}

### "Salary expectations"
> Refer to profile.yml targets (€15-18/hour for working student)

### "When can you start?"
> Refer to profile.yml (immediate or specify semester break)

### "Do you speak German?"
> Honest A2-B1 level, improving (refer to coursework if relevant)

Format for easy copy-paste. Include word count if field has limits.
