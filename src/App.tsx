import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import "./index.css";

interface Lesson {
    id: string;
    name: string;
    completed: boolean;
}

function App() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [currentGroup, setCurrentGroup] = useState(1);
    const [loading, setLoading] = useState(true);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    // Dữ liệu bài học từ file lesson.txt
    const lessonGroups = {
        1: [
            "Part 1 01",
            "Part 2 01",
            "Part 3 01",
            "Part 4 01",
            "Part 5 01",
            "Part 5 02",
            "Part 6 01",
            "Part 6 02",
            "Part 7 01",
        ],
        2: [
            "Part 1 02",
            "Part 1 03",
            "Part 2 02",
            "Part 3 02",
            "Part 4 02",
            "Part 5 03",
            "Part 6 03",
            "Part 7 02",
            "Part 7 03",
        ],
        3: [
            "Part 1 04",
            "Part 1 05",
            "Part 2 03",
            "Part 3 03",
            "Part 4 03",
            "Part 5 04",
            "Part 5 05",
            "Part 6 04",
            "Part 6 05",
            "Part 7 04",
        ],
    };

    // Tính nhóm bài học theo ngày
    const getCurrentGroup = () => {
        const today = new Date();
        const dayOfYear = Math.floor(
            (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
                1000 /
                60 /
                60 /
                24
        );
        return (dayOfYear % 3) + 1;
    };

    // Lấy ngày hôm nay dạng string
    const getTodayString = () => {
        return new Date().toISOString().split("T")[0];
    };

    // Load dữ liệu từ Firebase
    useEffect(() => {
        const group = getCurrentGroup();
        setCurrentGroup(group);

        const todayString = getTodayString();
        const lessonsRef = doc(db, "daily-lessons", todayString);

        // Load lessons cho ngày hôm nay
        const unsubscribeLessons = onSnapshot(lessonsRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setLessons(data.lessons || []);
            } else {
                // Tạo dữ liệu mới cho ngày hôm nay
                const initialLessons = lessonGroups[
                    group as keyof typeof lessonGroups
                ].map((name, index) => ({
                    id: `${group}-${index}`,
                    name,
                    completed: false,
                }));
                setLessons(initialLessons);
                setDoc(lessonsRef, { lessons: initialLessons, group });
            }
            setLoading(false);
        });

        return () => {
            unsubscribeLessons();
        };
    }, []);

    // Cập nhật thời gian mỗi phút
    useEffect(() => {
        const updateTime = () => {
            setCurrentDateTime(new Date());
        };

        // Cập nhật ngay lập tức
        updateTime();

        // Tính toán thời gian đến phút tiếp theo
        const now = new Date();
        const secondsUntilNextMinute = 60 - now.getSeconds();

        // Set timeout đến đầu phút tiếp theo
        const initialTimeout = setTimeout(() => {
            updateTime();
            // Sau đó cập nhật mỗi phút
            const timer = setInterval(updateTime, 60000);

            return () => clearInterval(timer);
        }, secondsUntilNextMinute * 1000);

        return () => clearTimeout(initialTimeout);
    }, []);

    // Format thời gian Việt Nam
    const formatVietnameseDateTime = (date: Date) => {
        const vietnamTime = new Date(
            date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
        );

        const dayNames = [
            "Chủ Nhật",
            "Thứ Hai",
            "Thứ Ba",
            "Thứ Tư",
            "Thứ Năm",
            "Thứ Sáu",
            "Thứ Bảy",
        ];
        const dayName = dayNames[vietnamTime.getDay()];

        const day = vietnamTime.getDate().toString().padStart(2, "0");
        const month = (vietnamTime.getMonth() + 1).toString().padStart(2, "0");
        const year = vietnamTime.getFullYear();

        const hours = vietnamTime.getHours().toString().padStart(2, "0");
        const minutes = vietnamTime.getMinutes().toString().padStart(2, "0");

        return `${dayName}, ${day}/${month}/${year} - ${hours}:${minutes}`;
    };

    // Toggle trạng thái hoàn thành bài học
    const toggleLesson = async (lessonId: string) => {
        const updatedLessons = lessons.map((lesson) => {
            if (lesson.id === lessonId) {
                return { ...lesson, completed: !lesson.completed };
            }
            return lesson;
        });

        setLessons(updatedLessons);

        // Lưu vào Firebase
        const todayString = getTodayString();
        const lessonsRef = doc(db, "daily-lessons", todayString);
        await setDoc(lessonsRef, {
            lessons: updatedLessons,
            group: currentGroup,
        });
    };

    const completedCount = lessons.filter((lesson) => lesson.completed).length;
    const progressPercentage =
        lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0;

    if (loading) {
        return (
            <div className="app">
                <div className="loading">Đang tải...</div>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="header">
                <div className="header-info">
                    {formatVietnameseDateTime(currentDateTime)}
                </div>
            </header>

            <main className="main-content">
                <div className="progress-section">
                    <h2>Tiến độ hôm nay</h2>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progressPercentage}%` }}
                        ></div>
                    </div>
                    <p className="progress-text">
                        {completedCount}/{lessons.length} bài đã hoàn thành (
                        {Math.round(progressPercentage)}%)
                    </p>
                </div>

                <div className="lessons-section">
                    <h3>Danh sách bài học - Nhóm {currentGroup}</h3>
                    <ul className="lessons-list">
                        {lessons.map((lesson) => (
                            <li key={lesson.id} className="lesson-item">
                                <label className="lesson-label">
                                    <input
                                        type="checkbox"
                                        checked={lesson.completed}
                                        onChange={() => toggleLesson(lesson.id)}
                                        className="lesson-checkbox"
                                    />
                                    <span
                                        className={`lesson-text ${
                                            lesson.completed ? "completed" : ""
                                        }`}
                                    >
                                        {lesson.name}
                                    </span>
                                    <span className="checkmark"></span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            </main>
        </div>
    );
}

export default App;
