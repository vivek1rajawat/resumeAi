const { GoogleGenAI } = require("@google/genai");
const puppeteer = require("puppeteer");
const pdfParse = require("pdf-parse");

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

// ===============================
//  PDF → TEXT
// ===============================
async function extractTextFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length < 50) {
      throw new Error("Empty PDF");
    }

    console.log("RESUME TEXT EXTRACTED");
    return data.text;
  } catch (err) {
    console.log("❌ PDF ERROR:", err.message);
    return "";
  }
}

// ===============================
//  robust JSON extraction
// ===============================
function extractJsonObject(text) {
  if (!text) return null;

  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch (_) {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    const maybeJson = clean.slice(start, end + 1);
    try {
      return JSON.parse(maybeJson);
    } catch (_) {
      return null;
    }
  }
}

function mapQuestions(arr = [], type = "technical") {
  if (!Array.isArray(arr)) return [];
  return arr.map((q) => ({
    question: q?.question || q?.q || "No question provided",
    intention:
      q?.intention ||
      q?.focus_area ||
      q?.topic ||
      (type === "technical"
        ? "Check technical understanding"
        : "Check communication"),
    answer:
      q?.answer ||
      (type === "technical" ? "Explain in detail" : "Explain clearly"),
  }));
}

function splitMissingRequirementsToSkillGaps(missing) {
  if (!missing || typeof missing !== "string") return [];
  return missing
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((skill) => ({ skill, severity: "medium" }));
}

function isGenAiKeyLeakedError(err) {
  const msg = String(err?.message || "");
  return (
    msg.includes("reported as leaked") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("403")
  );
}

// ===============================
//  INTERVIEW REPORT
// ===============================
async function generateInterviewReport({
  resume,
  selfDescription,
  jobDescription,
}) {
  const resumeText = resume ? await extractTextFromPdf(resume) : "";

  const prompt = `
You are an expert interviewer and ATS analyzer.

Return ONLY valid JSON (no markdown, no extra text).

Required schema:
{
  "matchScore": number,
  "title": string,
  "technicalQuestions": [{"question": string, "intention": string, "answer": string}],
  "behavioralQuestions": [{"question": string, "intention": string, "answer": string}],
  "skillGaps": [{"skill": string, "severity": "low"|"medium"|"high"}],
  "preparationPlan": [{"day": number, "focus": string, "tasks": [string]}]
}

Rules:
- Minimum 5 technical questions
- Minimum 3 behavioral questions
- Questions must be based on resume + job description (avoid generic)

Resume:
${resumeText || "EMPTY"}

Self Description:
${selfDescription || "EMPTY"}

Job Description:
${jobDescription || "EMPTY"}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    // NOTE: don't log full text in production (can be huge); keep it short
    console.log("🤖 Gemini response received");

    const raw = extractJsonObject(response.text);
    if (!raw) throw new Error("Invalid JSON from model");

    const data = raw.interview_report || raw;

    const technicalSrc =
      data.technicalQuestions ||
      data.technical_questions ||
      data?.questions?.technical_questions ||
      data?.questions?.technicalQuestions ||
      data?.questions?.technical_evaluation ||
      data?.technical_evaluation ||
      [];

    const behavioralSrc =
      data.behavioralQuestions ||
      data.behavioral_questions ||
      data?.questions?.behavioral_questions ||
      data?.questions?.behavioralQuestions ||
      data?.questions?.behavioral_evaluation ||
      data?.behavioral_evaluation ||
      [];

    const skillGapsSrc =
      data.skillGaps ||
      data.skill_gaps ||
      data?.job_fit_analysis?.missing_requirements ||
      "";

    const preparationPlanSrc = data.preparationPlan || data?.learning_roadmap || [];

    const normalized = {
      matchScore: Number(data.matchScore ?? raw.matchScore ?? 50),
      title: data.title || raw.title || "Interview Report",
      technicalQuestions: mapQuestions(technicalSrc, "technical"),
      behavioralQuestions: mapQuestions(behavioralSrc, "behavioral"),
      skillGaps: Array.isArray(skillGapsSrc)
        ? skillGapsSrc
        : splitMissingRequirementsToSkillGaps(skillGapsSrc),
      preparationPlan: Array.isArray(preparationPlanSrc)
        ? preparationPlanSrc.map((item, i) => {
            if (item && typeof item === "object" && !Array.isArray(item)) return item;
            return {
              day: i + 1,
              focus: String(item).split(":")[0] || "Learning",
              tasks: [String(item)],
            };
          })
        : [],
    };

    while (normalized.technicalQuestions.length < 5) {
      normalized.technicalQuestions.push({
        question: "Explain a feature you built and the key tradeoffs you made.",
        intention: "Validate real development experience",
        answer: "Explain in detail with code-level reasoning",
      });
    }

    while (normalized.behavioralQuestions.length < 3) {
      normalized.behavioralQuestions.push({
        question: "Tell me about a challenge you faced and how you handled it.",
        intention: "Problem solving & communication",
        answer: "Use STAR format",
      });
    }

    return normalized;
  } catch (err) {
    if (isGenAiKeyLeakedError(err)) {
      console.error(
        "❌ GEMINI 403: API key reported as leaked. Replace GOOGLE_GENAI_API_KEY in Render Environment."
      );
    } else {
      console.error("❌ AI ERROR:", err?.message || err);
    }

    // Fallback response (app should still work)
    return {
      matchScore: 50,
      technicalQuestions: [
        {
          question: "Explain your main project",
          intention: "Experience",
          answer: "Explain clearly",
        },
        {
          question: "How do you manage state in React?",
          intention: "Concept",
          answer: "Hooks/Context",
        },
        {
          question: "How to optimize performance?",
          intention: "Skill",
          answer: "Memoization/lazy loading",
        },
        {
          question: "Explain useEffect with example",
          intention: "Depth",
          answer: "Explain lifecycle",
        },
        {
          question: "How do you handle API errors?",
          intention: "Practical",
          answer: "Try/catch + retries",
        },
      ],
      behavioralQuestions: [
        {
          question: "Tell me about yourself",
          intention: "Communication",
          answer: "Explain",
        },
        {
          question: "Describe a challenge",
          intention: "Problem solving",
          answer: "Explain",
        },
        {
          question: "How do you learn new tech?",
          intention: "Growth",
          answer: "Explain",
        },
      ],
      skillGaps: [
        { skill: "Backend depth", severity: "high" },
        { skill: "MongoDB", severity: "medium" },
      ],
      preparationPlan: [
        {
          day: 1,
          focus: "React + JS",
          tasks: ["Revise hooks, closures, async/await"],
        },
        {
          day: 2,
          focus: "Backend basics",
          tasks: ["Build Express routes + MongoDB CRUD"],
        },
        { day: 3, focus: "Interview prep", tasks: ["Practice questions"] },
      ],
      title: "Interview Report",
    };
  }
}

// ===============================
//  PDF GENERATOR (Render friendly)
// ===============================
async function generatePdfFromHtml(html) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: 60000,
    });

    const page = await browser.newPage();

    // Better print defaults
    await page.emulateMediaType("screen");

    // prevent hanging forever if some resource blocks
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // small settle time helps in server environments
  // small settle time helps in server environments
await new Promise((r) => setTimeout(r, 250));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });

    return pdfBuffer;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ===============================
//  RESUME BUILDER (Gemini -> JSON)
// ===============================
async function generateResumeJson({ resumeText, jobDescription, selfDescription }) {
  const prompt = `
You are an expert resume writer.

Return ONLY valid JSON (no markdown, no extra text).

Create an ATS-friendly 1-page resume tailored to the Job Description.
Do NOT duplicate lines. Do NOT output raw resume text.

Schema:
{
  "name": string,
  "headline": string,
  "location": string,
  "email": string,
  "phone": string,
  "links": [{"label": "LinkedIn"|"GitHub"|"Portfolio"|"Other", "url": string}],
  "summary": string,
  "skills": {
    "languages": [string],
    "frameworks": [string],
    "tools": [string],
    "databases": [string],
    "other": [string]
  },
  "projects": [
    {
      "name": string,
      "tech": [string],
      "bullets": [string],
      "link": string
    }
  ],
  "experience": [
    {
      "company": string,
      "title": string,
      "location": string,
      "start": string,
      "end": string,
      "bullets": [string]
    }
  ],
  "education": [
    {
      "degree": string,
      "school": string,
      "location": string,
      "year": string
    }
  ],
  "certifications": [string]
}

Rules:
- Use strong action verbs and quantified impact where possible.
- 3–5 project bullets, each max 1 line.
- Keep summary 2–3 lines.
- Skills should be deduplicated and relevant to JD.
- If some fields are missing, use empty string/[] rather than making fake data.

Resume Text:
${resumeText || "EMPTY"}

Self Description:
${selfDescription || "EMPTY"}

Job Description:
${jobDescription || "EMPTY"}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  const raw = extractJsonObject(response.text);
  if (!raw) throw new Error("Resume JSON parse failed");

  return raw;
}

// ===============================
//  HTML RESUME TEMPLATE (styled)
// ===============================
function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
}

function renderResumeHtml(r) {
  const links = Array.isArray(r.links) ? r.links.filter((l) => l?.url) : [];
  const skills = r.skills || {};

  const skillGroup = (title, arr = []) => {
    const clean = Array.isArray(arr)
      ? [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))]
      : [];
    if (clean.length === 0) return "";
    return `
      <div class="skill-row">
        <div class="skill-title">${escapeHtml(title)}</div>
        <div class="skill-items">${escapeHtml(clean.join(", "))}</div>
      </div>
    `;
  };

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root {
      --text: #111827;
      --muted: #4b5563;
      --line: #e5e7eb;
      --accent: #111827;
      --bg: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Noto Sans", "Helvetica Neue", sans-serif;
      font-size: 11.2pt;
      line-height: 1.35;
    }
    .page { width: 100%; padding: 0; }
    .header {
      padding-bottom: 10px;
      border-bottom: 2px solid var(--text);
      margin-bottom: 12px;
    }
    .name {
      font-size: 20pt;
      font-weight: 800;
      letter-spacing: 0.2px;
      margin: 0;
    }
    .headline {
      margin: 2px 0 0 0;
      font-size: 11.5pt;
      color: var(--muted);
      font-weight: 600;
    }
    .contact {
      margin-top: 6px;
      color: var(--muted);
      font-size: 10.5pt;
    }
    .contact a { color: var(--muted); text-decoration: none; }
    .contact a:hover { text-decoration: underline; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 240px;
      gap: 14px;
    }
    .section { margin-bottom: 12px; }
    .section-title {
      font-weight: 800;
      font-size: 11.5pt;
      margin: 0 0 6px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--line);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .item-title { font-weight: 800; margin: 0; }
    .item-meta { color: var(--muted); font-size: 10.5pt; margin: 2px 0 0 0; }
    ul { margin: 6px 0 0 18px; padding: 0; }
    li { margin: 0 0 3px 0; }
    .skill-row { margin-bottom: 6px; }
    .skill-title { font-weight: 800; font-size: 10.5pt; margin-bottom: 2px; }
    .skill-items { color: var(--muted); font-size: 10.5pt; }
    .project-tech { color: var(--muted); font-size: 10.5pt; margin-top: 2px; }
    .small { font-size: 10.5pt; color: var(--muted); }
    @page { size: A4; margin: 14mm; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1 class="name">${escapeHtml(r.name || "Your Name")}</h1>
      <div class="headline">${escapeHtml(r.headline || "")}</div>
      <div class="contact">
        ${[
          r.location ? escapeHtml(r.location) : "",
          r.phone ? escapeHtml(r.phone) : "",
          r.email ? escapeHtml(r.email) : "",
          ...links.map((l) => `<a href="${escapeHtml(l.url)}">${escapeHtml(l.label || "Link")}</a>`),
        ]
          .filter(Boolean)
          .join(" | ")}
      </div>
    </div>

    <div class="grid">
      <div>
        ${
          r.summary
            ? `<div class="section">
                <div class="section-title">Summary</div>
                <div>${escapeHtml(r.summary)}</div>
              </div>`
            : ""
        }

        ${
          Array.isArray(r.projects) && r.projects.length
            ? `<div class="section">
                <div class="section-title">Projects</div>
                ${r.projects
                  .slice(0, 3)
                  .map(
                    (p) => `
                  <div class="section" style="margin-bottom:10px;">
                    <div class="item-title">
                      ${escapeHtml(p.name || "Project")}
                      ${
                        p.link
                          ? `<span class="small"> — <a href="${escapeHtml(p.link)}">${escapeHtml(p.link)}</a></span>`
                          : ""
                      }
                    </div>
                    ${
                      Array.isArray(p.tech) && p.tech.length
                        ? `<div class="project-tech">${escapeHtml(p.tech.join(" • "))}</div>`
                        : ""
                    }
                    ${renderList(Array.isArray(p.bullets) ? p.bullets.slice(0, 5) : [])}
                  </div>
                `
                  )
                  .join("")}
              </div>`
            : ""
        }

        ${
          Array.isArray(r.experience) && r.experience.length
            ? `<div class="section">
                <div class="section-title">Experience</div>
                ${r.experience
                  .slice(0, 3)
                  .map(
                    (e) => `
                  <div class="section" style="margin-bottom:10px;">
                    <div class="item-title">${escapeHtml(e.title || "")}${e.company ? ` — ${escapeHtml(e.company)}` : ""}</div>
                    <div class="item-meta">
                      ${[e.location, [e.start, e.end].filter(Boolean).join(" - ")]
                        .filter(Boolean)
                        .map(escapeHtml)
                        .join(" | ")}
                    </div>
                    ${renderList(Array.isArray(e.bullets) ? e.bullets.slice(0, 5) : [])}
                  </div>
                `
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>

      <div>
        <div class="section">
          <div class="section-title">Skills</div>
          ${skillGroup("Languages", skills.languages)}
          ${skillGroup("Frameworks", skills.frameworks)}
          ${skillGroup("Tools", skills.tools)}
          ${skillGroup("Databases", skills.databases)}
          ${skillGroup("Other", skills.other)}
        </div>

        ${
          Array.isArray(r.education) && r.education.length
            ? `<div class="section">
                <div class="section-title">Education</div>
                ${r.education
                  .slice(0, 2)
                  .map(
                    (ed) => `
                  <div class="section" style="margin-bottom:8px;">
                    <div class="item-title">${escapeHtml(ed.degree || "")}</div>
                    <div class="item-meta">${[ed.school, ed.location, ed.year].filter(Boolean).map(escapeHtml).join(" | ")}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>`
            : ""
        }

        ${
          Array.isArray(r.certifications) && r.certifications.length
            ? `<div class="section">
                <div class="section-title">Certifications</div>
                ${renderList(r.certifications.slice(0, 6))}
              </div>`
            : ""
        }
      </div>
    </div>
  </div>
</body>
</html>
`;
}

// ===============================
//  RESUME PDF (PROFESSIONAL)
// ===============================
async function generateResumePdf({ resume, jobDescription, selfDescription }) {
  const resumeText = resume ? await extractTextFromPdf(resume) : "";

  try {
    const resumeJson = await generateResumeJson({
      resumeText,
      jobDescription,
      selfDescription,
    });

    const html = renderResumeHtml(resumeJson);
    return generatePdfFromHtml(html);
  } catch (err) {
    if (isGenAiKeyLeakedError(err)) {
      console.error(
        '❌ RESUME AI ERROR: API key leaked/blocked (403). Replace "GOOGLE_GENAI_API_KEY" in Render Environment.'
      );
    } else {
      console.error("❌ RESUME AI ERROR:", err?.message || err);
    }

    // fallback minimal nice template
    const html = renderResumeHtml({
      name: "Your Name",
      headline: "Software Developer",
      location: "",
      email: "",
      phone: "",
      links: [],
      summary:
        "ATS-friendly resume could not be generated automatically. Please try again or provide a cleaner PDF.",
      skills: { languages: [], frameworks: [], tools: [], databases: [], other: [] },
      projects: [],
      experience: [],
      education: [],
      certifications: [],
    });

    return generatePdfFromHtml(html);
  }
}

module.exports = {
  generateInterviewReport,
  generateResumePdf,
};