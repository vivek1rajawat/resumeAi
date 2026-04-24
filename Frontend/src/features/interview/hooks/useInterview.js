import {
  getAllInterviewReports,
  generateInterviewReport,
  getInterviewReportById,
  generateResumePdf,
} from "../services/interview.api";

import { useContext, useEffect } from "react";
import { InterviewContext } from "../interview.context";
import { useParams } from "react-router";

export const useInterview = () => {
  const context = useContext(InterviewContext);
  const { interviewId } = useParams();

  if (!context) {
    throw new Error("useInterview must be used within an InterviewProvider");
  }

  const { loading, setLoading, report, setReport, reports, setReports } =
    context;

  // 🔥 GENERATE REPORT
  const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
    setLoading(true);

    try {
      const response = await generateInterviewReport({
        jobDescription,
        selfDescription,
        resumeFile,
      });

      const finalReport = response?.interviewReport;
      if (!finalReport) throw new Error("Invalid response format");

      setReport(finalReport);
      return finalReport;
    } catch (error) {
      console.log("ERROR:", error);
      alert("Failed to generate report");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 🔥 GET REPORT BY ID
  const getReportById = async (id) => {
    setLoading(true);

    try {
      const response = await getInterviewReportById(id);
      const finalReport = response?.interviewReport;

      if (!finalReport) throw new Error("Invalid response format");

      setReport(finalReport);
      return finalReport;
    } catch (error) {
      console.log("ERROR:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 🔥 GET ALL REPORTS
  const getReports = async () => {
    setLoading(true);

    try {
      const response = await getAllInterviewReports();
      const list = response?.interviewReports || [];
      setReports(list);
      return list;
    } catch (error) {
      console.log(error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 🔥 DOWNLOAD RESUME PDF
  const getResumePdf = async (interviewReportId) => {
    setLoading(true);

    try {
      const pdfBlob = await generateResumePdf({ interviewReportId });

      // If backend returned an error JSON as blob, try to detect it
      // (common when server sends 500 with JSON but client expects blob)
      if (pdfBlob?.type && pdfBlob.type.includes("application/json")) {
        const text = await pdfBlob.text();
        console.log("PDF endpoint returned JSON:", text);
        alert("PDF generation failed (server returned an error). Check backend logs.");
        return;
      }

      const url = window.URL.createObjectURL(pdfBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `resume_${interviewReportId}.pdf`;
      document.body.appendChild(link);
      link.click();

      // cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.log("PDF DOWNLOAD ERROR:", error);
      alert("Failed to download PDF");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (interviewId) {
      getReportById(interviewId);
    } else {
      getReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  return {
    loading,
    report,
    reports,
    generateReport,
    getReportById,
    getReports,
    getResumePdf,
  };
};