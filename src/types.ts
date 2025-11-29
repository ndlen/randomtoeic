// Định nghĩa các interfaces và types cho ứng dụng TOEIC

// Các phần thi TOEIC
export type TOEICPart =
    | "Part 1"
    | "Part 2"
    | "Part 3"
    | "Part 4"
    | "Part 5"
    | "Part 6"
    | "Part 7";

// Loại bài thi: Listening hoặc Reading
export type ExamType = "Listening" | "Reading";

// Thông tin một bài thi
export interface ExamItem {
    id: string; // VD: "Part 1 01"
    part: TOEICPart; // Part của bài thi
    examNumber: number; // Số thứ tự bài trong part (01, 02...)
    duration: number; // Thời gian làm bài (phút)
    type: ExamType; // Listening hoặc Reading
}

// Trạng thái hoàn thành bài thi trong ngày
export interface DailyExamStatus {
    examId: string; // ID của bài thi
    isCompleted: boolean; // Đã tick xong chưa
    assignedDate: string; // Ngày được assign (YYYY-MM-DD)
}

// Thống kê luyện tập
export interface ExamStats {
    examId: string; // ID của bài thi
    completedCount: number; // Số lần đã hoàn thành
    lastCompletedDate?: string; // Ngày cuối cùng hoàn thành (YYYY-MM-DD)
}

// Dữ liệu của một user
export interface UserData {
    userId: string; // ID user (có thể dùng "default" nếu không cần auth)
    currentDate: string; // Ngày hiện tại (YYYY-MM-DD)
    dailyExams: DailyExamStatus[]; // Danh sách đề hôm nay
    examStats: ExamStats[]; // Thống kê toàn bộ đề
    recentHistory: string[]; // Lịch sử 2-3 ngày gần nhất (examIds)
    carryOverExams: string[]; // Đề chưa hoàn thành từ ngày trước
}

// Cấu hình hệ thống
export interface SystemConfig {
    targetDailyMinutes: number; // Tổng thời gian mục tiêu mỗi ngày (~180 phút)
    listeningRatio: number; // Tỉ lệ Listening (~0.67)
    readingRatio: number; // Tỉ lệ Reading (~0.33)
    maxListeningCount: number; // Giới hạn số lần luyện Listening (20)
    maxReadingCount: number; // Giới hạn số lần luyện Reading (10)
    historyDays: number; // Số ngày lịch sử để tránh trùng lặp (3)
}

// Response từ API random
export interface RandomExamResponse {
    success: boolean;
    dailyExams: DailyExamStatus[];
    totalDuration: number;
    message?: string;
}

// Đây là dữ liệu cố định về các bài thi
export const EXAM_DATA: ExamItem[] = [
    // Part 1: 5 đề (6 phút/đề)
    {
        id: "Part 1 01",
        part: "Part 1",
        examNumber: 1,
        duration: 6,
        type: "Listening",
    },
    {
        id: "Part 1 02",
        part: "Part 1",
        examNumber: 2,
        duration: 6,
        type: "Listening",
    },
    {
        id: "Part 1 03",
        part: "Part 1",
        examNumber: 3,
        duration: 6,
        type: "Listening",
    },
    {
        id: "Part 1 04",
        part: "Part 1",
        examNumber: 4,
        duration: 6,
        type: "Listening",
    },
    {
        id: "Part 1 05",
        part: "Part 1",
        examNumber: 5,
        duration: 6,
        type: "Listening",
    },

    // Part 2: 3 đề (14 phút/đề)
    {
        id: "Part 2 01",
        part: "Part 2",
        examNumber: 1,
        duration: 14,
        type: "Listening",
    },
    {
        id: "Part 2 02",
        part: "Part 2",
        examNumber: 2,
        duration: 14,
        type: "Listening",
    },
    {
        id: "Part 2 03",
        part: "Part 2",
        examNumber: 3,
        duration: 14,
        type: "Listening",
    },

    // Part 3: 3 đề (25 phút/đề)
    {
        id: "Part 3 01",
        part: "Part 3",
        examNumber: 1,
        duration: 25,
        type: "Listening",
    },
    {
        id: "Part 3 02",
        part: "Part 3",
        examNumber: 2,
        duration: 25,
        type: "Listening",
    },
    {
        id: "Part 3 03",
        part: "Part 3",
        examNumber: 3,
        duration: 25,
        type: "Listening",
    },

    // Part 4: 3 đề (25 phút/đề)
    {
        id: "Part 4 01",
        part: "Part 4",
        examNumber: 1,
        duration: 25,
        type: "Listening",
    },
    {
        id: "Part 4 02",
        part: "Part 4",
        examNumber: 2,
        duration: 25,
        type: "Listening",
    },
    {
        id: "Part 4 03",
        part: "Part 4",
        examNumber: 3,
        duration: 25,
        type: "Listening",
    },

    // Part 5: 5 đề (15 phút/đề)
    {
        id: "Part 5 01",
        part: "Part 5",
        examNumber: 1,
        duration: 15,
        type: "Reading",
    },
    {
        id: "Part 5 02",
        part: "Part 5",
        examNumber: 2,
        duration: 15,
        type: "Reading",
    },
    {
        id: "Part 5 03",
        part: "Part 5",
        examNumber: 3,
        duration: 15,
        type: "Reading",
    },
    {
        id: "Part 5 04",
        part: "Part 5",
        examNumber: 4,
        duration: 15,
        type: "Reading",
    },
    {
        id: "Part 5 05",
        part: "Part 5",
        examNumber: 5,
        duration: 15,
        type: "Reading",
    },

    // Part 6: 5 đề (10 phút/đề)
    {
        id: "Part 6 01",
        part: "Part 6",
        examNumber: 1,
        duration: 10,
        type: "Reading",
    },
    {
        id: "Part 6 02",
        part: "Part 6",
        examNumber: 2,
        duration: 10,
        type: "Reading",
    },
    {
        id: "Part 6 03",
        part: "Part 6",
        examNumber: 3,
        duration: 10,
        type: "Reading",
    },
    {
        id: "Part 6 04",
        part: "Part 6",
        examNumber: 4,
        duration: 10,
        type: "Reading",
    },
    {
        id: "Part 6 05",
        part: "Part 6",
        examNumber: 5,
        duration: 10,
        type: "Reading",
    },

    // Part 7: 4 đề (30 phút/đề)
    {
        id: "Part 7 01",
        part: "Part 7",
        examNumber: 1,
        duration: 30,
        type: "Reading",
    },
    {
        id: "Part 7 02",
        part: "Part 7",
        examNumber: 2,
        duration: 30,
        type: "Reading",
    },
    {
        id: "Part 7 03",
        part: "Part 7",
        examNumber: 3,
        duration: 30,
        type: "Reading",
    },
    {
        id: "Part 7 04",
        part: "Part 7",
        examNumber: 4,
        duration: 30,
        type: "Reading",
    },
];

// Cấu hình mặc định
export const DEFAULT_CONFIG: SystemConfig = {
    targetDailyMinutes: 180,
    listeningRatio: 0.67,
    readingRatio: 0.33,
    maxListeningCount: 20,
    maxReadingCount: 10,
    historyDays: 3,
};
