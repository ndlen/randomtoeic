import React, { useState, useEffect, useMemo } from "react";
import type { DailyExamStatus } from "../types";
import { getCurrentExamInfo } from "../randomService";
import { toggleExamCompleted } from "../firebaseService";

interface DailyExamListProps {
    dailyExams: DailyExamStatus[];
    onExamToggle: (examId: string) => void;
    isLoading?: boolean;
}

const DailyExamList: React.FC<DailyExamListProps> = ({
    dailyExams,
    onExamToggle,
    isLoading = false,
}) => {
    const [completedExams, setCompletedExams] = useState<Set<string>>(
        new Set()
    );

    // Sử dụng useMemo thay vì useEffect để tránh cascading renders
    const initialCompletedExams = useMemo(() => {
        return new Set(
            dailyExams
                .filter((exam) => exam.isCompleted)
                .map((exam) => exam.examId)
        );
    }, [dailyExams]);

    // Cập nhật state khi initialCompletedExams thay đổi
    useEffect(() => {
        setCompletedExams(initialCompletedExams);
    }, [initialCompletedExams]);

    const handleExamToggle = async (examId: string) => {
        if (isLoading) return;

        const isCurrentlyCompleted = completedExams.has(examId);

        // Cập nhật state local ngay lập tức để UI responsive
        const newCompletedExams = new Set(completedExams);
        if (isCurrentlyCompleted) {
            newCompletedExams.delete(examId);
        } else {
            newCompletedExams.add(examId);
        }

        // Cập nhật Firebase cho cả check và uncheck
        await toggleExamCompleted(examId);

        setCompletedExams(newCompletedExams);
        onExamToggle(examId);
    };

    const getTotalDuration = () => {
        return dailyExams.reduce((total, exam) => {
            const examInfo = getCurrentExamInfo(exam.examId);
            return total + (examInfo ? examInfo.duration : 0);
        }, 0);
    };

    const getCompletedDuration = () => {
        return dailyExams.reduce((total, exam) => {
            if (!completedExams.has(exam.examId)) return total;
            const examInfo = getCurrentExamInfo(exam.examId);
            return total + (examInfo ? examInfo.duration : 0);
        }, 0);
    };

    const getExamsByType = (type: "Listening" | "Reading") => {
        return dailyExams.filter((exam) => {
            const examInfo = getCurrentExamInfo(exam.examId);
            return examInfo && examInfo.type === type;
        });
    };

    if (isLoading) {
        return (
            <div className="daily-exam-list loading">
                <div className="loading-spinner">Đang tải...</div>
            </div>
        );
    }

    if (dailyExams.length === 0) {
        return (
            <div className="daily-exam-list empty">
                <p>
                    Chưa có đề nào cho hôm nay. Hệ thống sẽ tự động random vào
                    0h.
                </p>
            </div>
        );
    }

    const listeningExams = getExamsByType("Listening");
    const readingExams = getExamsByType("Reading");
    const totalDuration = getTotalDuration();
    const completedDuration = getCompletedDuration();
    const progressPercentage =
        totalDuration > 0 ? (completedDuration / totalDuration) * 100 : 0;

    return (
        <div className="daily-exam-list">
            {/* Header với thông tin tổng quan */}
            <div className="exam-summary">
                <h2>Kế hoạch luyện thi hôm nay</h2>
                <div className="duration-info">
                    <span className="total-duration">
                        Tổng thời gian: {completedDuration}/{totalDuration} phút
                        ({progressPercentage.toFixed(1)}%)
                    </span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${progressPercentage}%` }}
                    ></div>
                </div>
            </div>

            {/* Listening Section */}
            {listeningExams.length > 0 && (
                <div className="exam-section">
                    <h3 className="section-title">
                        📻 Listening ({listeningExams.length} đề)
                    </h3>
                    <div className="exam-grid">
                        {listeningExams.map((exam, index) => {
                            const examInfo = getCurrentExamInfo(exam.examId);
                            const isCompleted = completedExams.has(exam.examId);

                            return (
                                <div
                                    key={`${exam.examId}-${exam.assignedDate}-${index}`}
                                    className={`exam-card ${
                                        isCompleted ? "completed" : ""
                                    }`}
                                    onClick={() =>
                                        handleExamToggle(exam.examId)
                                    }
                                >
                                    <div className="exam-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={isCompleted}
                                            onChange={() => {}} // Handled by div onClick
                                            readOnly
                                        />
                                    </div>
                                    <div className="exam-info">
                                        <div className="exam-title">
                                            {exam.examId}
                                        </div>
                                        <div className="exam-duration">
                                            {examInfo?.duration} phút
                                        </div>
                                        {isCompleted && (
                                            <div className="completed-badge">
                                                ✓
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Reading Section */}
            {readingExams.length > 0 && (
                <div className="exam-section">
                    <h3 className="section-title">
                        📚 Reading ({readingExams.length} đề)
                    </h3>
                    <div className="exam-grid">
                        {readingExams.map((exam, index) => {
                            const examInfo = getCurrentExamInfo(exam.examId);
                            const isCompleted = completedExams.has(exam.examId);

                            return (
                                <div
                                    key={`${exam.examId}-${exam.assignedDate}-reading-${index}`}
                                    className={`exam-card ${
                                        isCompleted ? "completed" : ""
                                    }`}
                                    onClick={() =>
                                        handleExamToggle(exam.examId)
                                    }
                                >
                                    <div className="exam-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={isCompleted}
                                            onChange={() => {}} // Handled by div onClick
                                            readOnly
                                        />
                                    </div>
                                    <div className="exam-info">
                                        <div className="exam-title">
                                            {exam.examId}
                                        </div>
                                        <div className="exam-duration">
                                            {examInfo?.duration} phút
                                        </div>
                                        {isCompleted && (
                                            <div className="completed-badge">
                                                ✓
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Footer stats */}
            <div className="exam-footer">
                <div className="stats">
                    <span>
                        Hoàn thành: {completedExams.size}/{dailyExams.length} đề
                    </span>
                    <span>
                        Còn lại: {totalDuration - completedDuration} phút
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DailyExamList;
