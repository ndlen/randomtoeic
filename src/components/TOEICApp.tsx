import React, { useState, useEffect } from "react";
import DailyExamList from "./DailyExamList";
import ExamHistory from "./ExamHistory";
import type { DailyExamStatus, ExamStats } from "../types";
import {
    getUserData,
    getTodayExams,
    toggleExamCompleted,
} from "../firebaseService";
import { generateDailyExams, getVietnamDate } from "../randomService";
import {
    useServiceWorkerUpdate,
    usePWAInstall,
    useOfflineStatus,
} from "../hooks/usePWA";

const TOEICApp: React.FC = () => {
    const [dailyExams, setDailyExams] = useState<DailyExamStatus[]>([]);
    const [examStats, setExamStats] = useState<ExamStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
    const [isGenerating, setIsGenerating] = useState(false);

    // PWA Hooks
    const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();
    const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
    const isOffline = useOfflineStatus();

    // Khởi tạo dữ liệu khi component mount
    useEffect(() => {
        initializeApp();
    }, []);

    // Đơn giản: chỉ cập nhật thời gian hiển thị
    useEffect(() => {
        const interval = setInterval(() => {
            setLastUpdateTime(new Date());
        }, 60000); // Cập nhật mỗi phút

        return () => clearInterval(interval);
    }, []);

    const initializeApp = async () => {
        setIsLoading(true);
        try {
            // CHỈ lấy dữ liệu có sẵn, không tự động sinh đề
            console.log("📋 Đang lấy dữ liệu...");
            const userData = await getUserData("default");

            if (userData && userData.dailyExams) {
                const todayExams = await getTodayExams("default");
                setDailyExams(todayExams);
                setExamStats(userData.examStats || []);
                console.log(`✅ Đã tải ${todayExams.length} đề hiện tại`);
            } else {
                console.log("🔄 Chưa có đề - hãy nhấn nút 'Ngày Mới'");
                setDailyExams([]);
                setExamStats([]);
            }
        } catch (error) {
            console.error("Error loading app:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewDayReset = async () => {
        setIsGenerating(true);
        try {
            const result = await generateDailyExams("default");
            if (result.success) {
                setDailyExams(result.dailyExams);

                // Cập nhật lại stats
                const userData = await getUserData("default");
                if (userData) {
                    setExamStats(userData.examStats);
                }
            }
        } catch (error) {
            console.error("Error resetting for new day:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExamToggle = async (examId: string) => {
        // Cập nhật state local ngay lập tức cho UX
        setDailyExams((prev) =>
            prev.map((exam) =>
                exam.examId === examId
                    ? { ...exam, isCompleted: !exam.isCompleted }
                    : exam
            )
        );

        // Cập nhật Firebase và stats
        try {
            const success = await toggleExamCompleted(examId, "default");
            if (success) {
                console.log("✅ Đã cập nhật Firebase");
                // Refresh stats từ database
                const userData = await getUserData("default");
                if (userData) {
                    setExamStats(userData.examStats || []);
                }
            } else {
                console.error("❌ Lỗi cập nhật Firebase");
                // Rollback state nếu lỗi
                setDailyExams((prev) =>
                    prev.map((exam) =>
                        exam.examId === examId
                            ? { ...exam, isCompleted: !exam.isCompleted }
                            : exam
                    )
                );
            }
        } catch (error) {
            console.error("❌ Error toggling exam:", error);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="toeic-app">
            {/* PWA Update Notification */}
            {updateAvailable && (
                <div className="pwa-update-banner">
                    <div className="update-message">
                        <span>🆕 Phiên bản mới có sẵn!</span>
                        <button className="update-btn" onClick={applyUpdate}>
                            Cập nhật ngay
                        </button>
                    </div>
                </div>
            )}

            {/* Offline Indicator */}
            {isOffline && (
                <div className="offline-banner">
                    📱 Đang offline - Một số tính năng có thể bị giới hạn
                </div>
            )}

            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <h1>🎯 TOEIC Random Hôm Nay</h1>
                    <div className="header-info">
                        <span className="current-date">
                            📅 {getVietnamDate()}
                        </span>
                        <span className="last-update">
                            ⏰ Cập nhật: {formatTime(lastUpdateTime)}
                        </span>
                    </div>
                </div>

                <div className="header-actions">
                    {/* Button sinh đề mới manual */}
                    <button
                        className="new-exam-btn"
                        onClick={handleNewDayReset}
                        disabled={isGenerating}
                        title="Sinh đề mới cho hôm nay"
                        style={{
                            backgroundColor: "#4CAF50",
                            color: "white",
                            fontSize: "0.9em",
                            fontWeight: "bold",
                            padding: "8px 16px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: isGenerating ? "not-allowed" : "pointer",
                        }}
                    >
                        {isGenerating ? "⏳ Đang tạo..." : "🌅 Ngày Mới"}
                    </button>

                    {isInstallable && (
                        <button
                            className="install-btn"
                            onClick={promptInstall}
                            title="Cài đặt ứng dụng lên thiết bị"
                        >
                            📲 Cài đặt
                        </button>
                    )}

                    <button
                        className="history-btn"
                        onClick={() => setShowHistory(!showHistory)}
                        title="Xem lịch sử luyện tập"
                    >
                        📄 Lịch sử
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                {isGenerating && (
                    <div className="generating-overlay">
                        <div className="generating-message">
                            <div className="spinner"></div>
                            <p>Đang random đề mới...</p>
                        </div>
                    </div>
                )}

                {/* History Panel */}
                {showHistory && (
                    <ExamHistory
                        examStats={examStats}
                        isVisible={showHistory}
                        onToggle={() => setShowHistory(false)}
                    />
                )}

                {/* Daily Exam List */}
                {!showHistory && (
                    <DailyExamList
                        dailyExams={dailyExams}
                        onExamToggle={handleExamToggle}
                        isLoading={isLoading}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <div className="footer-content">
                    <div className="tips">
                        💡 <strong>Tips:</strong>
                        Nhấn nút <strong>"🎲 Đề Mới"</strong> khi muốn tạo bộ đề
                        mới. Refresh trang sẽ giữ nguyên đề hiện tại.
                    </div>

                    <div className="system-info">
                        <span>🔥 Target: 180 phút/ngày</span>
                        <span>🎧 Listening: ~120p</span>
                        <span>📚 Reading: ~60p</span>
                        {isInstalled && <span>📲 PWA Installed</span>}
                        {isOffline && <span>📱 Offline Mode</span>}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default TOEICApp;
