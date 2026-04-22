import React, { useState, useEffect } from 'react';
import '../style/interview.scss';
import { useInterview } from '../hooks/useInterview.js';
import { useParams } from 'react-router';

const NAV_ITEMS = [
    { id: 'technical', label: 'Technical Questions' },
    { id: 'behavioral', label: 'Behavioral Questions' },
    { id: 'roadmap', label: 'Road Map' },
];

//  Question Card
const QuestionCard = ({ item, index }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className='q-card'>
            <div
                className='q-card__header'
                onClick={() => setOpen(!open)}
            >
                <span className="q-card__index">Q{index + 1}</span>
                <p className="q-card__question">{item?.question}</p>
            </div>

            {open && (
                <div className='q-card__body'>
                    <div className="q-card__section">
                        <span className="q-card__tag q-card__tag--intention">
                            Intention
                        </span>
                        <p>{item?.intention}</p>
                    </div>

                    <div className="q-card__section">
                        <span className="q-card__tag q-card__tag--answer">
                            Answer
                        </span>
                        <p>{item?.answer}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

//  Roadmap
const RoadMapDay = ({ day }) => (
    <div className='roadmap-day'>
        <div className="roadmap-day__header">
            <span className="roadmap-day__badge">Day {day?.day}</span>
            <h3 className="roadmap-day__focus">{day?.focus}</h3>
        </div>

        <ul className="roadmap-day__tasks">
            {day?.tasks?.map((task, i) => (
                <li key={i}>
                    <span className="roadmap-day__bullet"></span>
                    {task}
                </li>
            ))}
        </ul>
    </div>
);

//  MAIN COMPONENT
const Interview = () => {

    const [activeNav, setActiveNav] = useState('technical');
    const { report, getReportById, loading, getResumePdf } = useInterview();
    const { interviewId } = useParams();

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId);
        }
    }, [interviewId]);

    //  Loading state
    if (loading || !report) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        );
    }

    //  Safe data
    const safeReport = {
        matchScore: report?.matchScore || 0,
        technicalQuestions: report?.technicalQuestions || [],
        behavioralQuestions: report?.behavioralQuestions || [],
        preparationPlan: report?.preparationPlan || [],
        skillGaps: report?.skillGaps || []
    };

    return (
        <div className="interview-page">

            <div className="interview-layout">

                {/* LEFT NAV */}
                <div className="interview-nav">
                    <p className="interview-nav__label">Sections</p>

                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            className={`interview-nav__item ${
                                activeNav === item.id ? "interview-nav__item--active" : ""
                            }`}
                            onClick={() => setActiveNav(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}

                    <button
                        className="interview-nav__item"
                        onClick={() => getResumePdf(interviewId)}
                    >
                        Download Resume
                    </button>
                </div>

                <div className="interview-divider"></div>

                {/* MAIN CONTENT */}
                <div className="interview-content">

                    {activeNav === 'technical' && (
                        <section>
                            <div className="content-header">
                                <h2>Technical Questions</h2>
                                <span className="content-header__count">
                                    {safeReport.technicalQuestions.length}
                                </span>
                            </div>

                            <div className="q-list">
                                {safeReport.technicalQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        </section>
                    )}

                    {activeNav === 'behavioral' && (
                        <section>
                            <div className="content-header">
                                <h2>Behavioral Questions</h2>
                                <span className="content-header__count">
                                    {safeReport.behavioralQuestions.length}
                                </span>
                            </div>

                            <div className="q-list">
                                {safeReport.behavioralQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        </section>
                    )}

                    {activeNav === 'roadmap' && (
                        <section>
                            <div className="content-header">
                                <h2>Roadmap</h2>
                            </div>

                            <div className="roadmap-list">
                                {safeReport.preparationPlan.map((day) => (
                                    <RoadMapDay key={day.day} day={day} />
                                ))}
                            </div>
                        </section>
                    )}

                </div>

                <div className="interview-divider"></div>

                {/* SIDEBAR */}
                <div className="interview-sidebar">

                    <div className="match-score">
                        <p className="match-score__label">Match Score</p>

                        <div className={`match-score__ring ${
                            safeReport.matchScore >= 80
                                ? 'score--high'
                                : safeReport.matchScore >= 60
                                ? 'score--mid'
                                : 'score--low'
                        }`}>
                            <span className="match-score__value">
                                {safeReport.matchScore}
                            </span>
                            <span className="match-score__pct">%</span>
                        </div>
                    </div>

                    <div className="sidebar-divider"></div>

                    <div className="skill-gaps">
                        <p className="skill-gaps__label">Skill Gaps</p>

                        <div className="skill-gaps__list">
                            {safeReport.skillGaps.map((gap, i) => (
                                <span
                                    key={i}
                                    className={`skill-tag skill-tag--${gap.severity}`}
                                >
                                    {gap.skill}
                                </span>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default Interview;