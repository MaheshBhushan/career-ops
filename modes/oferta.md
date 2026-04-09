# OFERTA MODE - Single Job Evaluation

## Input: Job URL or JD text
## Output: Report in reports/XXX-company-role-date.md

Execute Blocks A-F:

### Block A - Role Summary
Detect archetype: FDE/SA/PM/LLMOps/ML/Transformation/Working Student
Summarize:
- Domain (platform/agentic/ML/enterprise/data)
- Function (build/consult/manage/research)
- Seniority level (Junior/Mid/Senior - reject if Senior+)
- Remote policy (hybrid/onsite/remote)
- Location (match against profile.yml location_preferences)
- TL;DR in 1 sentence

### Block B - CV Match
Create requirement mapping table:
| JD Requirement | CV Evidence | Match Score |
|----------------|-------------|-------------|
| Python 3+ years | cv.md: Built FinanRAG in Python, People Tech experience | Strong (4/5) |
| RAG/LLM exp | cv.md: FinanRAG with FAISS, semantic search | Strong (5/5) |
| Cloud (Azure) | cv.md: Azure App Services, Functions | Medium (3/5) |
| German language | profile.yml: A2-B1 | Weak (2/5) |

Calculate overall fit score (0-5).

### Block C - Red Flags
Detect and flag:
- "Fast-paced" -> understaffed team
- "Wear many hats" -> undefined role
- "Rockstar/Ninja" -> toxic culture signal
- Vague requirements -> internal confusion
- Salary below profile.yml minimum
- Requires German C1 when user has A2-B1
- 5+ years experience required (user has ~1 year)

If 2+ red flags, score below 3.0.

### Block D - Missing Info
What to ask about:
- Team size and structure
- Tech stack versions (PyTorch 1.x vs 2.x?)
- Mentorship structure for working students
- On-call expectations
- German language requirements (must-have or nice-to-have?)
- Visa sponsorship clarity

### Block E - Tailored CV Summary
Rewrite profile summary injecting JD keywords:
Original: "Applied AI developer building production ML systems"
Tailored: "{{TAILORED_SUMMARY_WITH_KEYWORDS}}"

### Block F - STAR Stories
Pre-write behavioral interview answers:

**"Tell me about a challenging project"**
-> FinanRAG story: Built RAG pipeline for financial docs. Challenge: embedding quality at scale. Solution: optimized chunking + FAISS. Result: 85% accuracy.

**"How do you handle tight deadlines"**
-> People Tech story: Delivered automotive OS features in 4-month internship. Prioritized automation, reduced QA cycles by 20%.

**"Describe teamwork experience"**
-> Coderelics story: Led 200+ member tech community. Organized 300+ participant hackathons. Improved participation by 30%.

**"Why this company?"**
-> Research company products, connect to user's projects.

Score: 0-5 scale.
- 4.0+: Proceed to PDF generation
- 3.0-3.9: Flag for manual review
- Below 3.0: Reject with reason
