const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");
const pdf = require("pdf-parse");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
});

// PDF PARSER (FINAL FIX)
async function extractTextFromPdf(buffer) {
    try {
        const data = await pdf(buffer);

        if (!data.text || data.text.trim().length < 50) {
            throw new Error("Empty or invalid PDF");
        }

        console.log("✅ RESUME TEXT EXTRACTED");
        return data.text;

    } catch (err) {
        console.log("❌ PDF FAILED:", err.message);
        return ""; // ❗ NO FAKE TEXT
    }
}

// SCHEMA
const interviewReportSchema = z.object({
    matchScore: z.number(),
    technicalQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })),
    behavioralQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })),
    skillGaps: z.array(z.object({
        skill: z.string(),
        severity: z.enum(["low", "medium", "high"])
    })),
    preparationPlan: z.array(z.object({
        day: z.number(),
        focus: z.string(),
        tasks: z.array(z.string())
    })),
    title: z.string()
});

// SAFE RESPONSE CLEANER (NO DATA LOSS)
function fixAIResponse(data) {
    return {
        matchScore: data.matchScore || 50,
        technicalQuestions: data.technicalQuestions || [],
        behavioralQuestions: data.behavioralQuestions || [],
        skillGaps: data.skillGaps || [],
        preparationPlan: data.preparationPlan || [],
        title: data.title || "Interview Report"
    };
}

// MAIN FUNCTION
async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

    let resumeText = "";

    if (resume) {
        resumeText = await extractTextFromPdf(resume);
    }

    console.log("📄 RESUME PREVIEW:", resumeText.slice(0, 200));

    const prompt = `
You are an expert interview coach.

Generate a COMPLETE interview report in STRICT JSON format.

Resume:
${resumeText || "No resume provided"}

Self Description:
${selfDescription || "Fresher"}

Job Description:
${jobDescription || "Software Developer"}

IMPORTANT:
- Use resume STRICTLY to generate questions
- Questions MUST be based on candidate skills
- DO NOT generate generic questions
- DO NOT repeat common questions like "What is React?"
- Make questions specific to technologies mentioned in resume
- Roadmap must target weak areas from resume
- Minimum 3 technical questions
- Minimum 2 behavioral questions
- Include realistic skill gaps
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(interviewReportSchema),
            }
        });

        console.log("🤖 AI RAW:", response.text);

        const raw = JSON.parse(response.text);
        return fixAIResponse(raw);

    } catch (err) {
        console.log("❌ AI ERROR:", err.message);

        //  FINAL FALLBACK (ONLY IF AI FAILS)
        return {
            matchScore: 50,
            technicalQuestions: [
                {
                    question: "Explain a project you built using your main technology",
                    intention: "Check real experience",
                    answer: "Describe your project in detail"
                },
                {
                    question: "How would you improve your existing skills?",
                    intention: "Check growth mindset",
                    answer: "Explain learning approach"
                },
                {
                    question: "Explain any concept from your resume deeply",
                    intention: "Check depth",
                    answer: "Give structured explanation"
                }
            ],
            behavioralQuestions: [
                {
                    question: "Tell me about yourself",
                    intention: "Communication",
                    answer: "Explain clearly"
                },
                {
                    question: "Describe a challenge you faced",
                    intention: "Problem solving",
                    answer: "Explain situation and solution"
                }
            ],
            skillGaps: [
                { skill: "Advanced concepts", severity: "medium" },
                { skill: "Real project experience", severity: "high" }
            ],
            preparationPlan: [
                { day: 1, focus: "Core concepts", tasks: ["Revise basics"] },
                { day: 2, focus: "Projects", tasks: ["Build project"] },
                { day: 3, focus: "Interview prep", tasks: ["Practice questions"] }
            ],
            title: "Interview Report"
        };
    }
}

//PDF GENERATOR
async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    });

    await browser.close();

    return pdfBuffer;
}

// RESUME PDF
async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string()
    });

    let resumeText = "";

    if (resume) {
        resumeText = await extractTextFromPdf(resume);
    }

    const prompt = `
Generate a professional resume in HTML format.

Resume:
${resumeText}

Self Description:
${selfDescription}

Job Description:
${jobDescription}

Return ONLY JSON:
{ "html": "<html>" }
`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    });

    const jsonContent = JSON.parse(response.text);

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html);

    return pdfBuffer;
}

module.exports = { generateInterviewReport, generateResumePdf };