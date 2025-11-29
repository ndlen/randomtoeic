import { EXAM_DATA, DEFAULT_CONFIG } from "./types";
import type {
    ExamItem,
    DailyExamStatus,
    ExamStats,
    RandomExamResponse,
    TOEICPart,
} from "./types";
import {
    getUserData,
    resetDailyData,
    updateRecentHistory,
} from "./firebaseService";

// Utility: Lấy ngày hiện tại theo múi giờ Việt Nam
export const getVietnamDate = (): string => {
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000); // UTC+7
    return vietnamTime.toISOString().slice(0, 10); // YYYY-MM-DD
};

// Utility: Kiểm tra xem có phải ngày mới không
export const isNewDay = (currentDate: string): boolean => {
    return currentDate !== getVietnamDate();
};

// Tính trọng số cho thuật toán random
export const calculateWeight = (
    examId: string,
    examStats: ExamStats[]
): number => {
    const stats = examStats.find((stat) => stat.examId === examId);
    const completedCount = stats ? stats.completedCount : 0;

    // Trọng số = 1 / (số lần đã ôn + 1)
    return 1 / (completedCount + 1);
};

// Kiểm tra xem đề có đạt giới hạn chưa
export const isExamAtLimit = (
    examId: string,
    examStats: ExamStats[]
): boolean => {
    const exam = EXAM_DATA.find((e) => e.id === examId);
    if (!exam) return true;

    // Đảm bảo examStats tồn tại
    const safeExamStats = examStats || [];
    const stats = safeExamStats.find((stat) => stat.examId === examId);
    const completedCount = stats ? stats.completedCount : 0;

    if (exam.type === "Listening") {
        return completedCount >= DEFAULT_CONFIG.maxListeningCount;
    } else {
        return completedCount >= DEFAULT_CONFIG.maxReadingCount;
    }
};

// Lọc các đề có thể random
export const getEligibleExams = (
    examStats: ExamStats[],
    recentHistory: string[],
    carryOverExams: string[] = []
): ExamItem[] => {
    return EXAM_DATA.filter((exam) => {
        // Loại bỏ đề đã đạt giới hạn
        if (isExamAtLimit(exam.id, examStats)) return false;

        // Loại bỏ đề trong lịch sử gần đây (trừ carry-over)
        if (
            !carryOverExams.includes(exam.id) &&
            recentHistory.includes(exam.id)
        )
            return false;

        return true;
    });
};

// Random có trọng số
export const weightedRandom = (
    items: ExamItem[],
    weights: number[]
): ExamItem | null => {
    if (items.length === 0) return null;

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) return items[0]; // Fallback

    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (let i = 0; i < items.length; i++) {
        currentWeight += weights[i];
        if (random <= currentWeight) {
            return items[i];
        }
    }

    return items[items.length - 1]; // Fallback
};

// Đảm bảo bao phủ đủ 7 parts
export const ensureAllParts = (selectedExams: ExamItem[]): ExamItem[] => {
    const allParts: TOEICPart[] = [
        "Part 1",
        "Part 2",
        "Part 3",
        "Part 4",
        "Part 5",
        "Part 6",
        "Part 7",
    ];
    const coveredParts = new Set(selectedExams.map((exam) => exam.part));

    const missingParts = allParts.filter((part) => !coveredParts.has(part));

    if (missingParts.length === 0) return selectedExams;

    // Thêm ít nhất 1 đề cho mỗi part bị thiếu
    const result = [...selectedExams];
    const existingIds = new Set(selectedExams.map((exam) => exam.id));

    missingParts.forEach((missingPart) => {
        const availableExams = EXAM_DATA.filter(
            (exam) => exam.part === missingPart && !existingIds.has(exam.id)
        );
        if (availableExams.length > 0) {
            // Chọn đề đầu tiên chưa có trong selectedExams
            result.push(availableExams[0]);
            existingIds.add(availableExams[0].id);
        }
    });

    return result;
};

// Logic random chính
export const generateDailyExams = async (
    userId: string = "default_user"
): Promise<RandomExamResponse> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) {
            return {
                success: false,
                dailyExams: [],
                totalDuration: 0,
                message: "Không thể lấy dữ liệu user",
            };
        }

        // Đảm bảo các arrays cần thiết tồn tại
        if (!userData.examStats) userData.examStats = [];
        if (!userData.recentHistory) userData.recentHistory = [];
        if (!userData.carryOverExams) userData.carryOverExams = [];

        const today = getVietnamDate();
        let targetMinutes = DEFAULT_CONFIG.targetDailyMinutes;
        let selectedExams: ExamItem[] = [];

        // 1. Xử lý carry-over từ ngày trước
        if (userData.carryOverExams.length > 0) {
            const carryOverItems = userData.carryOverExams
                .map((examId) => EXAM_DATA.find((exam) => exam.id === examId))
                .filter((exam) => exam !== undefined) as ExamItem[];

            selectedExams.push(...carryOverItems);
            const carryOverDuration = carryOverItems.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );
            targetMinutes -= carryOverDuration;
        }

        // 2. Lấy danh sách đề có thể random
        const eligibleExams = getEligibleExams(
            userData.examStats,
            userData.recentHistory,
            userData.carryOverExams
        );

        if (eligibleExams.length === 0) {
            return {
                success: false,
                dailyExams: [],
                totalDuration: 0,
                message: "Không có đề nào khả dụng để random",
            };
        }

        // 3. Phân loại theo Listening/Reading
        const listeningExams = eligibleExams.filter(
            (exam) => exam.type === "Listening"
        );
        const readingExams = eligibleExams.filter(
            (exam) => exam.type === "Reading"
        );

        // 4. Tính toán thời gian target cho từng loại
        const targetListeningMinutes = Math.round(
            targetMinutes * DEFAULT_CONFIG.listeningRatio
        );
        const targetReadingMinutes = targetMinutes - targetListeningMinutes;

        // 5. Random Listening exams
        let currentListeningMinutes = 0;
        while (
            currentListeningMinutes < targetListeningMinutes &&
            listeningExams.length > 0
        ) {
            const weights = listeningExams.map((exam) =>
                calculateWeight(exam.id, userData.examStats)
            );
            const selectedExam = weightedRandom(listeningExams, weights);

            if (!selectedExam) break;

            selectedExams.push(selectedExam);
            currentListeningMinutes += selectedExam.duration;

            // Loại bỏ đề đã chọn
            const index = listeningExams.findIndex(
                (exam) => exam.id === selectedExam.id
            );
            listeningExams.splice(index, 1);
        }

        // 6. Random Reading exams
        let currentReadingMinutes = 0;
        while (
            currentReadingMinutes < targetReadingMinutes &&
            readingExams.length > 0
        ) {
            const weights = readingExams.map((exam) =>
                calculateWeight(exam.id, userData.examStats)
            );
            const selectedExam = weightedRandom(readingExams, weights);

            if (!selectedExam) break;

            selectedExams.push(selectedExam);
            currentReadingMinutes += selectedExam.duration;

            // Loại bỏ đề đã chọn
            const index = readingExams.findIndex(
                (exam) => exam.id === selectedExam.id
            );
            readingExams.splice(index, 1);
        }

        // 7. Đảm bảo đủ 7 parts và loại bỏ duplicate
        selectedExams = ensureAllParts(selectedExams);

        // Loại bỏ duplicates bằng cách chỉ giữ lại exam đầu tiên của mỗi ID
        const uniqueExams: ExamItem[] = [];
        const seenIds = new Set<string>();

        for (const exam of selectedExams) {
            if (!seenIds.has(exam.id)) {
                seenIds.add(exam.id);
                uniqueExams.push(exam);
            }
        }

        selectedExams = uniqueExams;

        // 8. Tạo danh sách DailyExamStatus
        const dailyExams: DailyExamStatus[] = selectedExams.map((exam) => ({
            examId: exam.id,
            isCompleted: false,
            assignedDate: today,
        }));

        // 9. Cập nhật database
        const totalDuration = selectedExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );
        const examIds = selectedExams.map((exam) => exam.id);

        await resetDailyData(dailyExams, userId);
        await updateRecentHistory(examIds, userId);

        return {
            success: true,
            dailyExams,
            totalDuration,
            message: `Đã random thành công ${selectedExams.length} đề với tổng thời lượng ${totalDuration} phút`,
        };
    } catch (error) {
        console.error("Error generating daily exams:", error);
        return {
            success: false,
            dailyExams: [],
            totalDuration: 0,
            message: "Có lỗi xảy ra khi random đề",
        };
    }
};

// Kiểm tra và tự động reset nếu là ngày mới
export const checkAndResetIfNewDay = async (
    userId: string = "default_user"
): Promise<RandomExamResponse | null> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) return null;

        if (isNewDay(userData.currentDate)) {
            return await generateDailyExams(userId);
        }

        return null; // Không cần reset
    } catch (error) {
        console.error("Error checking for new day:", error);
        return null;
    }
};

// Lấy thông tin đề hiện tại
export const getCurrentExamInfo = (examId: string): ExamItem | null => {
    return EXAM_DATA.find((exam) => exam.id === examId) || null;
};
