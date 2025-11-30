import { EXAM_DATA, DEFAULT_CONFIG } from "./types";
import type {
    ExamItem,
    DailyExamStatus,
    ExamStats,
    RandomExamResponse,
    TOEICPart,
} from "./types";
import { getUserData, updateUserData } from "./firebaseService";

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

    return completedCount >= DEFAULT_CONFIG.maxListeningCount;
};

// Lấy thông tin đề thi theo ID
export const getCurrentExamInfo = (examId: string): ExamItem | null => {
    return EXAM_DATA.find((exam) => exam.id === examId) || null;
};

// Weighted random selection
export const weightedRandom = (
    items: ExamItem[],
    weights: number[]
): ExamItem | null => {
    if (items.length === 0) return null;

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) return null;

    let randomNum = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
        randomNum -= weights[i];
        if (randomNum <= 0) {
            return items[i];
        }
    }

    // Fallback
    return items[items.length - 1];
};

// Đảm bảo có đủ tất cả 7 parts
export const ensureAllParts = (selectedExams: ExamItem[]): ExamItem[] => {
    const requiredParts: TOEICPart[] = [
        "Part 1",
        "Part 2",
        "Part 3",
        "Part 4",
        "Part 5",
        "Part 6",
        "Part 7",
    ];

    const existingParts = new Set(selectedExams.map((exam) => exam.part));
    const missingParts = requiredParts.filter(
        (part) => !existingParts.has(part)
    );

    if (missingParts.length === 0) {
        return selectedExams;
    }

    // Thêm đề cho các part còn thiếu (chọn đề ngắn nhất)
    const result = [...selectedExams];
    for (const missingPart of missingParts) {
        const partExams = EXAM_DATA.filter((exam) => exam.part === missingPart);
        if (partExams.length > 0) {
            // Chọn đề ngắn nhất của part này
            const shortestExam = partExams.reduce((shortest, exam) =>
                exam.duration < shortest.duration ? exam : shortest
            );
            result.push(shortestExam);
        }
    }

    return result;
};

// Main function: Sinh đề thi ngẫu nhiên hàng ngày - LOGIC ĐƠN GIẢN
export const generateDailyExams = async (
    userId: string = "default"
): Promise<RandomExamResponse> => {
    try {
        // 1. Lấy dữ liệu user từ Firebase
        const userData = await getUserData(userId);
        if (!userData) {
            throw new Error("User data not found");
        }

        // 2. Target linh hoạt: sẽ điều chỉnh dựa trên kết quả thực tế để fit 170-190
        const MIN_TOTAL = 170;
        const MAX_TOTAL = 190;

        // Bắt đầu với target cao để có đủ đề, sau đó trim xuống
        const INITIAL_LISTENING_TARGET = 140; // Cao hơn để có đủ đề
        const INITIAL_READING_TARGET = 70; // Cao hơn để có đủ đề

        // 3. Lấy carry-over exams từ ngày trước
        const carryOverExams: ExamItem[] = [];

        if (userData.dailyExams) {
            const uncompletedExamIds = userData.dailyExams
                .filter((exam) => !exam.isCompleted)
                .map((exam) => exam.examId);

            for (const examId of uncompletedExamIds) {
                const exam = EXAM_DATA.find((e) => e.id === examId);
                if (exam) {
                    carryOverExams.push(exam);
                }
            }
        }

        console.log("🎯 Initial targets:", {
            listening: `~${INITIAL_LISTENING_TARGET} phút (will trim)`,
            reading: `~${INITIAL_READING_TARGET} phút (will trim)`,
            target: `${MIN_TOTAL}-${MAX_TOTAL} phút`,
            carryOver: `${carryOverExams.length} đề`,
        });

        // 4A. LISTENING: Bắt đầu với carry-over
        const listeningExams = carryOverExams.filter(
            (exam) => exam.type === "Listening"
        );
        let listeningDuration = listeningExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );

        // Lọc đề Listening có thể chọn (chưa limit + chưa có)
        const availableListening = EXAM_DATA.filter(
            (exam) =>
                exam.type === "Listening" &&
                !isExamAtLimit(exam.id, userData.examStats) &&
                !listeningExams.some((selected) => selected.id === exam.id)
        );

        // Thêm đề Listening cho đủ target cao (sẽ trim sau)
        while (
            listeningDuration < INITIAL_LISTENING_TARGET &&
            availableListening.length > 0
        ) {
            // Tính weight ưu tiên đề ôn ít
            const weights = availableListening.map((exam) =>
                calculateWeight(exam.id, userData.examStats)
            );

            const selectedExam = weightedRandom(availableListening, weights);
            if (!selectedExam) break;

            listeningExams.push(selectedExam);
            listeningDuration += selectedExam.duration;

            // Loại bỏ đề đã chọn
            const index = availableListening.findIndex(
                (exam) => exam.id === selectedExam.id
            );
            availableListening.splice(index, 1);
        }

        // 4B. READING: Tương tự với target cao
        const readingExams = carryOverExams.filter(
            (exam) => exam.type === "Reading"
        );
        let readingDuration = readingExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );

        // Lọc đề Reading có thể chọn
        const availableReading = EXAM_DATA.filter(
            (exam) =>
                exam.type === "Reading" &&
                !isExamAtLimit(exam.id, userData.examStats) &&
                !readingExams.some((selected) => selected.id === exam.id)
        );

        // Thêm đề Reading cho đủ target cao (sẽ trim sau)
        while (
            readingDuration < INITIAL_READING_TARGET &&
            availableReading.length > 0
        ) {
            const weights = availableReading.map((exam) =>
                calculateWeight(exam.id, userData.examStats)
            );

            const selectedExam = weightedRandom(availableReading, weights);
            if (!selectedExam) break;

            readingExams.push(selectedExam);
            readingDuration += selectedExam.duration;

            // Loại bỏ đề đã chọn
            const index = availableReading.findIndex(
                (exam) => exam.id === selectedExam.id
            );
            availableReading.splice(index, 1);
        }

        // 5. Gộp lại và đảm bảo đủ 7 parts
        let selectedExams = [...listeningExams, ...readingExams];
        selectedExams = ensureAllParts(selectedExams);

        let currentDuration = selectedExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );

        console.log(
            `📝 Before trim: ${currentDuration} phút, ${selectedExams.length} đề`
        );

        // 6. Trim thông minh để fit 170-190 phút VÀ duy trì tỷ lệ 2:1
        while (currentDuration > MAX_TOTAL && selectedExams.length > 7) {
            // Tính tỷ lệ hiện tại
            const currentListening = selectedExams
                .filter((e) => e.type === "Listening")
                .reduce((sum, e) => sum + e.duration, 0);
            const currentReading = selectedExams
                .filter((e) => e.type === "Reading")
                .reduce((sum, e) => sum + e.duration, 0);

            // Tỷ lệ lý tưởng cho tổng hiện tại là 2:1
            const idealListening = Math.floor((currentDuration * 2) / 3);
            const idealReading = currentDuration - idealListening;

            // Xác định loại nào đang vượt tỷ lệ
            const listeningOverRatio = currentListening > idealListening;
            const readingOverRatio = currentReading > idealReading;

            // Đếm số đề mỗi part
            const partsCount = new Map<string, number>();
            selectedExams.forEach((exam) => {
                partsCount.set(exam.part, (partsCount.get(exam.part) || 0) + 1);
            });

            // Tìm đề có thể xóa: ưu tiên loại vượt tỷ lệ + không phải carry-over + part có >1 đề
            const candidatesForRemoval = selectedExams
                .filter((exam) => {
                    const isCarryOver = carryOverExams.some(
                        (co) => co.id === exam.id
                    );
                    const partCount = partsCount.get(exam.part) || 0;
                    return !isCarryOver && partCount > 1; // Chỉ xóa nếu part này còn >1 đề
                })
                .sort((a, b) => {
                    // Ưu tiên 1: Xóa loại đang vượt tỷ lệ trước
                    const aIsOverRatio =
                        (listeningOverRatio && a.type === "Listening") ||
                        (readingOverRatio && a.type === "Reading");
                    const bIsOverRatio =
                        (listeningOverRatio && b.type === "Listening") ||
                        (readingOverRatio && b.type === "Reading");

                    if (aIsOverRatio !== bIsOverRatio) {
                        return bIsOverRatio ? 1 : -1; // Đưa loại vượt tỷ lệ lên đầu để xóa
                    }

                    // Ưu tiên 2: Xóa đề đã ôn nhiều nhất
                    const statsA = userData.examStats.find(
                        (s) => s.examId === a.id
                    );
                    const statsB = userData.examStats.find(
                        (s) => s.examId === b.id
                    );
                    const countA = statsA ? statsA.completedCount : 0;
                    const countB = statsB ? statsB.completedCount : 0;
                    return countB - countA;
                });

            if (candidatesForRemoval.length === 0) {
                console.log(
                    "🛑 Cannot trim more without losing parts or breaking carry-over"
                );
                break;
            }

            const examToRemove = candidatesForRemoval[0];
            const indexToRemove = selectedExams.findIndex(
                (exam) => exam.id === examToRemove.id
            );
            const removedExam = selectedExams.splice(indexToRemove, 1)[0];

            console.log(
                `🗑️ Smart trim: ${removedExam.part} ${removedExam.examNumber
                    .toString()
                    .padStart(2, "0")} (${removedExam.type}, ${
                    removedExam.duration
                }min, completed: ${
                    userData.examStats.find((s) => s.examId === removedExam.id)
                        ?.completedCount || 0
                }) - ratio balancing`
            );

            currentDuration = selectedExams.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );
        }

        // 7. Kiểm tra kết quả cuối cùng
        const finalListening = selectedExams
            .filter((e) => e.type === "Listening")
            .reduce((sum, e) => sum + e.duration, 0);
        const finalReading = selectedExams
            .filter((e) => e.type === "Reading")
            .reduce((sum, e) => sum + e.duration, 0);
        const finalParts = [...new Set(selectedExams.map((e) => e.part))];

        console.log(`✅ FINAL RESULT:`, {
            total: `${currentDuration} phút`,
            listening: `${finalListening} phút`,
            reading: `${finalReading} phút`,
            ratio:
                finalReading > 0
                    ? `${
                          Math.round((finalListening / finalReading) * 10) / 10
                      }:1`
                    : "N/A",
            parts: `${finalParts.length}/7`,
            inRange:
                currentDuration >= MIN_TOTAL && currentDuration <= MAX_TOTAL
                    ? "✅ YES"
                    : "❌ NO",
        });

        // 8. Loại bỏ duplicates
        const uniqueExams: ExamItem[] = [];
        const seenIds = new Set<string>();

        for (const exam of selectedExams) {
            if (!seenIds.has(exam.id)) {
                seenIds.add(exam.id);
                uniqueExams.push(exam);
            }
        }

        selectedExams = uniqueExams;

        // 9. Sort theo thứ tự Part để dễ ôn (Part 1→2→3→4→5→6→7)
        const partOrder: TOEICPart[] = [
            "Part 1",
            "Part 2",
            "Part 3",
            "Part 4",
            "Part 5",
            "Part 6",
            "Part 7",
        ];

        selectedExams.sort((a, b) => {
            const aIndex = partOrder.indexOf(a.part);
            const bIndex = partOrder.indexOf(b.part);

            if (aIndex !== bIndex) {
                return aIndex - bIndex; // Sort by part order
            }

            // Nếu cùng part, sort theo exam number
            return a.examNumber - b.examNumber;
        });

        console.log(
            "📋 Final sorted exams:",
            selectedExams.map(
                (e) => `${e.part} ${e.examNumber.toString().padStart(2, "0")}`
            )
        );

        // 10. Tạo danh sách DailyExamStatus
        const dailyExams: DailyExamStatus[] = selectedExams.map((exam) => ({
            examId: exam.id,
            isCompleted: false,
            assignedDate: getVietnamDate(),
        }));

        // 11. Cập nhật database
        const totalDuration = selectedExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );

        const currentDate = getVietnamDate();

        await updateUserData({
            ...userData,
            currentDate,
            dailyExams,
            recentHistory: [
                currentDate,
                ...(userData.recentHistory || []).slice(0, 6), // Keep last 7 days
            ],
        });

        return {
            success: true,
            dailyExams,
            totalDuration,
        };
    } catch (error) {
        console.error("❌ Error generating daily exams:", error);
        return {
            success: false,
            dailyExams: [],
            totalDuration: 0,
            message: `Failed to generate daily exams: ${error}`,
        };
    }
};

// Kiểm tra và reset nếu là ngày mới
export const checkAndResetIfNewDay = async (
    userId: string = "default"
): Promise<RandomExamResponse | null> => {
    const userData = await getUserData(userId);
    if (!userData) return null;

    if (isNewDay(userData.currentDate || "")) {
        console.log("🌅 New day detected, generating new daily exams...");
        return await generateDailyExams(userId);
    }
    return null;
};
