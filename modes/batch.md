# BATCH MODE - Parallel Processing

## Input: data/pipeline.md with 10+ URLs
## Output: Merged results in data/applications.md

Spawn sub-agents:
- Agent 1: Jobs 1-3
- Agent 2: Jobs 4-6
- Agent 3: Jobs 7-10

Each runs auto-pipeline.md independently.
Collect results:
- Merge all reports/ entries
- Update data/applications.md
- Generate summary: "Processed 12 jobs, 8 PDFs generated, 4 flagged for review"
