const { generateInterviewReport, generateResumePdf } = require("../services/ai.service");
const interviewReportModel = require("../models/interviewReport.model");

//  GENERATE REPORT
const generateInterViewReportController = async (req, res) => {
  try {
    const { jobDescription, selfDescription } = req.body;
    const resume = req.file?.buffer;

    const report = await generateInterviewReport({
      resume,
      selfDescription,
      jobDescription,
    });

    const saved = await interviewReportModel.create({
      user: req.user.id,
      title: report.title,
      resume: resume?.toString("base64") || "",
      selfDescription,
      jobDescription,
      matchScore: report.matchScore,
      technicalQuestions: report.technicalQuestions,
      behavioralQuestions: report.behavioralQuestions,
      skillGaps: report.skillGaps,
      preparationPlan: report.preparationPlan,
    });

    return res.json({
      message: "Interview report generated successfully.",
      interviewReport: saved,
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Failed to generate report" });
  }
};

//  GET SINGLE REPORT
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

//  GET ALL REPORTS
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

//  DOWNLOAD RESUME PDF
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
      "Content-Disposition": `attachment; filename=resume.pdf`,
    });

    return res.send(pdf);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "PDF generation failed" });
  }
};

//  EXPORT ALL (IMPORTANT 🔥)
module.exports = {
  generateInterViewReportController,
  getInterviewReportByIdController,
  getAllInterviewReportsController,
  generateResumePdfController,
};