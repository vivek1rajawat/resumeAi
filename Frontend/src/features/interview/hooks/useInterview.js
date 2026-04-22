import {
    getAllInterviewReports,
    generateInterviewReport,
    getInterviewReportById,
    generateResumePdf
} from "../services/interview.api"

import { useContext, useEffect } from "react"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"

export const useInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const {
        loading,
        setLoading,
        report,
        setReport,
        reports,
        setReports
    } = context

    // 🔥 GENERATE REPORT
    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setLoading(true)

        try {
            const response = await generateInterviewReport({
                jobDescription,
                selfDescription,
                resumeFile
            })

            console.log("API RESPONSE:", response)

            // ✅ FINAL FIX (IMPORTANT)
            const finalReport = response?.interviewReport

            if (!finalReport) {
                throw new Error("Invalid response format")
            }

            setReport(finalReport)
            return finalReport

        } catch (error) {
            console.log("ERROR:", error)
            alert("Failed to generate report")
        } finally {
            setLoading(false)
        }
    }

    // 🔥 GET REPORT BY ID
    const getReportById = async (interviewId) => {
        setLoading(true)

        try {
            const response = await getInterviewReportById(interviewId)

            console.log("GET BY ID:", response)

            // ✅ FINAL FIX
            const finalReport = response?.interviewReport

            if (!finalReport) {
                throw new Error("Invalid response format")
            }

            setReport(finalReport)
            return finalReport

        } catch (error) {
            console.log("ERROR:", error)
        } finally {
            setLoading(false)
        }
    }

    // 🔥 GET ALL REPORTS
    const getReports = async () => {
        setLoading(true)

        try {
            const response = await getAllInterviewReports()

            setReports(response?.interviewReports || [])

            return response?.interviewReports

        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    // 🔥 DOWNLOAD RESUME PDF
    const getResumePdf = async (interviewReportId) => {
        setLoading(true)

        try {
            const response = await generateResumePdf({ interviewReportId })

            const url = window.URL.createObjectURL(
                new Blob([response], { type: "application/pdf" })
            )

            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `resume_${interviewReportId}.pdf`)
            document.body.appendChild(link)
            link.click()

        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        } else {
            getReports()
        }
    }, [interviewId])

    return {
        loading,
        report,
        reports,
        generateReport,
        getReportById,
        getReports,
        getResumePdf
    }
}