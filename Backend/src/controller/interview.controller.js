const {
  generateInterviewReport,
  generateResumePdf,
} = require("../services/ai.service");
const interviewReportModel = require("../models/interviewReport.model");

// ===============================
//  SAFE MAPPER
// ===============================
const mapQuestions = (arr = [], type = "technical") => {
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
    answer: q?.answer || "Explain in detail",
  }));
};

const mapSkillGaps = (val) => {
  // already array -> keep it but normalize shape
  if (Array.isArray(val)) {
    return val
      .map((x) => {
        if (typeof x === "string") return { skill: x.trim(), severity: "medium" };
        return {
          skill: x?.skill?.trim?.() || "Unknown",
          severity: x?.severity || "medium",
        };
      })
      .filter((x) => x.skill && x.skill !== "Unknown");
  }

  // string csv -> split
  if (typeof val === "string" && val.trim()) {
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((skill) => ({ skill, severity: "medium" }));
  }

  return [];
};

const mapPreparationPlan = (val, fallback = []) => {
  if (Array.isArray(val) && val.length) return val;

  // if Gemini gave learning_roadmap as array of strings
  if (Array.isArray(val)) {
    return val.map((item, i) => ({
      day: i + 1,
      focus: String(item).split(":")[0] || "Learning",
      tasks: [String(item)],
    }));
  }

  return fallback;
};

// ===============================
//  GENERATE REPORT
// ===============================
const generateInterViewReportController = async (req, res) => {
  try {
    const { jobDescription, selfDescription } = req.body;
    const resume = req.file?.buffer;

    const report = await generateInterviewReport({
      resume,
      selfDescription,
      jobDescription,
    });

    // report is expected normalized, but we keep extra safety:
    const data = report?.interview_report || report || {};

    //  IMPORTANT: support nested "questions" shape from your RAW output
    const technicalSource =
      data.technicalQuestions ||
      data.technical_questions ||
      data.technical_evaluation ||
      data.technical_assessment ||
      data?.questions?.technical_questions ||
      data?.questions?.technicalQuestions ||
      [];

    const behavioralSource =
      data.behavioralQuestions ||
      data.behavioral_questions ||
      data.behavioral_evaluation ||
      data.behavioral_assessment ||
      data?.questions?.behavioral_questions ||
      data?.questions?.behavioralQuestions ||
      [];

    //  skill gaps from multiple possible shapes
    const skillGapsSource =
      data.skillGaps ||
      data.skill_gaps ||
      report?.skillGaps ||
      data?.job_fit_analysis?.missing_requirements ||
      "";

    const prepFallback = [
      { day: 1, focus: "Basics", tasks: ["Revise core concepts"] },
      { day: 2, focus: "Projects", tasks: ["Build 1 project aligned to JD"] },
      { day: 3, focus: "Interview Prep", tasks: ["Practice questions"] },
    ];

    const normalized = {
      matchScore: Number(report?.matchScore ?? data?.matchScore ?? 50),

      technicalQuestions: mapQuestions(technicalSource, "technical"),
      behavioralQuestions: mapQuestions(behavioralSource, "behavioral"),

      skillGaps: mapSkillGaps(skillGapsSource),

      preparationPlan: mapPreparationPlan(
        report?.preparationPlan ??
          data?.preparationPlan ??
          data?.learning_roadmap,
        prepFallback
      ),

      title: report?.title || data?.title || "Interview Report",
    };

    // 🔥 FINAL SAFETY (never empty)
    if (normalized.technicalQuestions.length === 0) {
      normalized.technicalQuestions = [
        {
          question: "Explain your main project",
          intention: "Check real experience",
          answer: "Explain clearly",
        },
      ];
    }

    if (normalized.behavioralQuestions.length === 0) {
      normalized.behavioralQuestions = [
        {
          question: "Tell me about yourself",
          intention: "Communication",
          answer: "Explain clearly",
        },
      ];
    }

    // helpful logs while debugging
    console.log(" NORMALIZED COUNTS:", {
      technical: normalized.technicalQuestions.length,
      behavioral: normalized.behavioralQuestions.length,
      skillGaps: normalized.skillGaps.length,
      preparationPlan: normalized.preparationPlan.length,
    });

    //  SAVE
    const saved = await interviewReportModel.create({
      user: req.user.id,
      title: normalized.title,
      resume: resume?.toString("base64") || "",
      selfDescription,
      jobDescription,
      matchScore: normalized.matchScore,
      technicalQuestions: normalized.technicalQuestions,
      behavioralQuestions: normalized.behavioralQuestions,
      skillGaps: normalized.skillGaps,
      preparationPlan: normalized.preparationPlan,
    });

    return res.json({
      message: "Interview report generated successfully.",
      interviewReport: saved,
    });
  } catch (err) {
    console.log("❌ CONTROLLER ERROR:", err);
    return res.status(500).json({ message: "Failed to generate report" });
  }
};

// ===============================
//  GET SINGLE REPORT
// ===============================
const getInterviewReportByIdController = async (req, res) => {
  try {
    const { interviewId } = req.params;

    const report = await interviewReportModel.findOne({
      _id: interviewId,
      user: req.user.id,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.json({
      message: "Report fetched successfully",
      interviewReport: report,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error fetching report" });
  }
};

// ===============================
//  GET ALL REPORTS
// ===============================
const getAllInterviewReportsController = async (req, res) => {
  try {
    const reports = await interviewReportModel
      .find({ user: req.user.id })
      .sort({ createdAt: -1 });

    return res.json({
      message: "Reports fetched successfully",
      interviewReports: reports,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error fetching reports" });
  }
};

// ===============================
//  DOWNLOAD RESUME PDF
// ===============================
const generateResumePdfController = async (req, res) => {
  try {
    const { interviewReportId } = req.params;

    const report = await interviewReportModel.findById(interviewReportId);

    if (!report) {
      return res.status(404).json({ message: "Not found" });
    }

    const pdf = await generateResumePdf({
      resume: Buffer.from(report.resume, "base64"),
      jobDescription: report.jobDescription,
      selfDescription: report.selfDescription,
    });

    res.set({
  "Content-Type": "application/pdf",
  "Content-Disposition": `attachment; filename="resume_${interviewReportId}.pdf"`,
  "Content-Length": pdf.length,
  "Cache-Control": "no-store",
});

return res.status(200).end(pdf);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "PDF generation failed" });
  }
};

//  EXPORT
module.exports = {
  generateInterViewReportController,
  getInterviewReportByIdController,
  getAllInterviewReportsController,
  generateResumePdfController,
};