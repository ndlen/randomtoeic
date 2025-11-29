import React, { useState } from "react";
import { EXAM_DATA } from "../types";
import type { ExamStats } from "../types";
import { getCurrentExamInfo } from "../randomService";

interface ExamHistoryProps {
    examStats: ExamStats[];
    isVisible: boolean;
    onToggle: () => void;
}

const ExamHistory: React.FC<ExamHistoryProps> = ({
    examStats,
    isVisible,
    onToggle,
}) => {
    const [sortBy, setSortBy] = useState<"part" | "count" | "recent">("part");
    const [filterType, setFilterType] = useState<
        "all" | "Listening" | "Reading"
    >("all");

    // Chuẩn bị dữ liệu để hiển thị
    const getAllExamsWithStats = () => {
        // Safe check cho examStats
        const safeExamStats = examStats || [];

        return EXAM_DATA.map((exam) => {
            const stats = safeExamStats.find((stat) => stat.examId === exam.id);
            return {
                ...exam,
                completedCount: stats ? stats.completedCount : 0,
                lastCompletedDate: stats ? stats.lastCompletedDate : null,
            };
        });
    };

    // Lọc và sắp xếp
    const getFilteredAndSortedExams = () => {
        let exams = getAllExamsWithStats();

        // Lọc theo type
        if (filterType !== "all") {
            exams = exams.filter((exam) => exam.type === filterType);
        }

        // Sắp xếp
        exams.sort((a, b) => {
            switch (sortBy) {
                case "count":
                    return b.completedCount - a.completedCount;
                case "recent":
                    if (!a.lastCompletedDate && !b.lastCompletedDate) return 0;
                    if (!a.lastCompletedDate) return 1;
                    if (!b.lastCompletedDate) return -1;
                    return b.lastCompletedDate.localeCompare(
                        a.lastCompletedDate
                    );
                case "part":
                default: {
                    // Sắp xếp theo part và số thứ tự
                    const partOrder = [
                        "Part 1",
                        "Part 2",
                        "Part 3",
                        "Part 4",
                        "Part 5",
                        "Part 6",
                        "Part 7",
                    ];
                    const partA = partOrder.indexOf(a.part);
                    const partB = partOrder.indexOf(b.part);
                    if (partA !== partB) return partA - partB;
                    return a.examNumber - b.examNumber;
                }
            }
        });

        return exams;
    };

    // Thống kê tổng quan
    const getOverallStats = () => {
        // Safe check cho examStats
        const safeExamStats = examStats || [];

        const listeningStats = safeExamStats.filter((stat) => {
            const exam = getCurrentExamInfo(stat.examId);
            return exam && exam.type === "Listening";
        });

        const readingStats = safeExamStats.filter((stat) => {
            const exam = getCurrentExamInfo(stat.examId);
            return exam && exam.type === "Reading";
        });

        const totalListening = listeningStats.reduce(
            (sum, stat) => sum + stat.completedCount,
            0
        );
        const totalReading = readingStats.reduce(
            (sum, stat) => sum + stat.completedCount,
            0
        );

        const avgListening =
            listeningStats.length > 0
                ? (totalListening / listeningStats.length).toFixed(1)
                : "0";

        const avgReading =
            readingStats.length > 0
                ? (totalReading / readingStats.length).toFixed(1)
                : "0";

        return {
            totalListening,
            totalReading,
            avgListening,
            avgReading,
            totalExams: totalListening + totalReading,
        };
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "Chưa làm";
        try {
            return new Date(dateString).toLocaleDateString("vi-VN");
        } catch {
            return dateString;
        }
    };

    const getCompletionColor = (
        count: number,
        type: "Listening" | "Reading"
    ) => {
        const maxCount = type === "Listening" ? 20 : 10;
        const percentage = (count / maxCount) * 100;

        if (percentage >= 100) return "#ff4444"; // Đỏ - đã đạt giới hạn
        if (percentage >= 75) return "#ff8800"; // Cam - gần đạt
        if (percentage >= 50) return "#ffbb00"; // Vàng - trung bình
        if (percentage >= 25) return "#88dd88"; // Xanh nhạt - ít
        return "#cccccc"; // Xám - chưa làm
    };

    if (!isVisible) return null;

    // Early return nếu examStats chưa sẵn sàng
    if (!examStats || examStats.length === 0) {
        return (
            <div className="exam-history">
                <div className="history-header">
                    <h3>📊 Lịch sử luyện tập</h3>
                </div>
                <div className="no-history">
                    <p>
                        Chưa có dữ liệu lịch sử. Hãy bắt đầu làm bài để xem
                        thống kê!
                    </p>
                </div>
            </div>
        );
    }

    const filteredExams = getFilteredAndSortedExams();
    const overallStats = getOverallStats();

    return (
        <div className="exam-history">
            <div className="history-header">
                <div className="header-left">
                    <h3>📊 Lịch sử luyện tập</h3>
                    <button className="toggle-btn" onClick={onToggle}>
                        ✕
                    </button>
                </div>

                {/* Thống kê tổng quan */}
                <div className="overall-stats">
                    <div className="stat-item">
                        <span className="stat-label">Tổng số bài:</span>
                        <span className="stat-value">
                            {overallStats.totalExams}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Listening:</span>
                        <span className="stat-value">
                            {overallStats.totalListening} (TB:{" "}
                            {overallStats.avgListening})
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Reading:</span>
                        <span className="stat-value">
                            {overallStats.totalReading} (TB:{" "}
                            {overallStats.avgReading})
                        </span>
                    </div>
                </div>
            </div>

            {/* Filters and sorts */}
            <div className="history-controls">
                <div className="filter-group">
                    <label>Lọc theo:</label>
                    <select
                        value={filterType}
                        onChange={(e) =>
                            setFilterType(
                                e.target.value as
                                    | "all"
                                    | "Listening"
                                    | "Reading"
                            )
                        }
                    >
                        <option value="all">Tất cả</option>
                        <option value="Listening">Listening</option>
                        <option value="Reading">Reading</option>
                    </select>
                </div>

                <div className="sort-group">
                    <label>Sắp xếp theo:</label>
                    <select
                        value={sortBy}
                        onChange={(e) =>
                            setSortBy(
                                e.target.value as "part" | "count" | "recent"
                            )
                        }
                    >
                        <option value="part">Part</option>
                        <option value="count">Số lần làm</option>
                        <option value="recent">Mới nhất</option>
                    </select>
                </div>
            </div>

            {/* Exam table */}
            <div className="history-table-container">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Đề thi</th>
                            <th>Loại</th>
                            <th>Thời gian</th>
                            <th>Số lần</th>
                            <th>Lần cuối</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExams.map((exam) => (
                            <tr key={exam.id}>
                                <td className="exam-name">{exam.id}</td>
                                <td
                                    className={`exam-type ${exam.type.toLowerCase()}`}
                                >
                                    {exam.type === "Listening" ? "🎧" : "📖"}{" "}
                                    {exam.type}
                                </td>
                                <td className="exam-duration">
                                    {exam.duration}p
                                </td>
                                <td className="exam-count">
                                    <span
                                        className="count-badge"
                                        style={{
                                            backgroundColor: getCompletionColor(
                                                exam.completedCount,
                                                exam.type
                                            ),
                                            color:
                                                exam.completedCount > 0
                                                    ? "#fff"
                                                    : "#666",
                                        }}
                                    >
                                        {exam.completedCount}
                                    </span>
                                </td>
                                <td className="exam-last-date">
                                    {formatDate(
                                        exam.lastCompletedDate || undefined
                                    )}
                                </td>
                                <td className="exam-status">
                                    {exam.completedCount === 0 && (
                                        <span className="status-new">
                                            Chưa làm
                                        </span>
                                    )}
                                    {exam.completedCount > 0 &&
                                        exam.completedCount <
                                            (exam.type === "Listening"
                                                ? 20
                                                : 10) && (
                                            <span className="status-progress">
                                                Đang luyện
                                            </span>
                                        )}
                                    {exam.completedCount >=
                                        (exam.type === "Listening"
                                            ? 20
                                            : 10) && (
                                        <span className="status-complete">
                                            Hoàn thành
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="history-legend">
                <div className="legend-item">
                    <span
                        className="legend-color"
                        style={{ backgroundColor: "#cccccc" }}
                    ></span>
                    <span>Chưa làm</span>
                </div>
                <div className="legend-item">
                    <span
                        className="legend-color"
                        style={{ backgroundColor: "#88dd88" }}
                    ></span>
                    <span>Ít (1-25%)</span>
                </div>
                <div className="legend-item">
                    <span
                        className="legend-color"
                        style={{ backgroundColor: "#ffbb00" }}
                    ></span>
                    <span>Trung bình (25-50%)</span>
                </div>
                <div className="legend-item">
                    <span
                        className="legend-color"
                        style={{ backgroundColor: "#ff8800" }}
                    ></span>
                    <span>Nhiều (50-75%)</span>
                </div>
                <div className="legend-item">
                    <span
                        className="legend-color"
                        style={{ backgroundColor: "#ff4444" }}
                    ></span>
                    <span>Đạt giới hạn (75-100%)</span>
                </div>
            </div>
        </div>
    );
};

export default ExamHistory;
