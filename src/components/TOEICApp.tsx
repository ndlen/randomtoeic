import React, { useState, useEffect } from "react";
import DailyExamList from "./DailyExamList";
import ExamHistory from "./ExamHistory";
import type { DailyExamStatus, ExamStats } from "../types";
import { getUserData, getTodayExams } from "../firebaseService";
import {
    checkAndResetIfNewDay,
    generateDailyExams,
    getVietnamDate,
} from "../randomService";
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

    // Auto-refresh mỗi phút để kiểm tra ngày mới
    useEffect(() => {
        const interval = setInterval(async () => {
            const now = new Date();
            // Kiểm tra xem có phải 0h không
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                await handleNewDayReset();
            }
            setLastUpdateTime(now);
        }, 60000); // Check mỗi phút

        return () => clearInterval(interval);
    }, []);

    const initializeApp = async () => {
        setIsLoading(true);
        try {
            // Kiểm tra và reset nếu là ngày mới
            const resetResult = await checkAndResetIfNewDay("default");

            if (resetResult && resetResult.success) {
                setDailyExams(resetResult.dailyExams);
            } else {
                // Lấy dữ liệu hiện tại
                const todayExams = await getTodayExams("default");
                setDailyExams(todayExams);
            }

            // Lấy thống kê
            const userData = await getUserData("default");
            if (userData) {
                setExamStats(userData.examStats);
            }
        } catch (error) {
            console.error("Error initializing app:", error);
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
        // Cập nhật state local ngay lập tức
        setDailyExams((prev) =>
            prev.map((exam) =>
                exam.examId === examId
                    ? { ...exam, isCompleted: !exam.isCompleted }
                    : exam
            )
        );

        // Luôn refresh stats từ database sau khi toggle
        setTimeout(async () => {
            const userData = await getUserData();
            if (userData) {
                setExamStats(userData.examStats);
                console.log("Updated examStats:", userData.examStats); // Debug log
            }
        }, 500); // Delay nhỏ để đảm bảo Firebase đã cập nhật
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
                        📊 Lịch sử
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
                        Hệ thống tự động random đề mới vào 0h hàng ngày. Đề chưa
                        hoàn thành sẽ được chuyển sang ngày mai.
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
