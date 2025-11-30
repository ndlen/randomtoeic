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
    updateRecentHistory,
    updateUserData,
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
        let carryOverDuration = 0;
        if (userData.carryOverExams.length > 0) {
            const carryOverItems = userData.carryOverExams
                .map((examId) => EXAM_DATA.find((exam) => exam.id === examId))
                .filter((exam) => exam !== undefined) as ExamItem[];

            selectedExams.push(...carryOverItems);
            carryOverDuration = carryOverItems.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );
            targetMinutes -= carryOverDuration;

            console.log("🔄 Carry-over exams:", {
                count: carryOverItems.length,
                duration: carryOverDuration,
                exams: carryOverItems.map((e) => e.id),
            });
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

        // 4. Tính toán thời gian target với giới hạn chặt (170-190 phút TỔNG)
        const minTargetMinutes = 170;
        const maxTargetMinutes = 190;

        // Tính actual max cho new exams (trừ đi carry-over)
        const actualMaxForNewExams = maxTargetMinutes - carryOverDuration;

        const targetListeningMinutes = Math.round(targetMinutes * 0.67); // 67%
        const targetReadingMinutes = targetMinutes - targetListeningMinutes; // 33%

        console.log("🎯 Target distribution:", {
            totalMinutes: `${minTargetMinutes}-${maxTargetMinutes}`,
            carryOverDuration: `${carryOverDuration} phút`,
            maxForNewExams: `${actualMaxForNewExams} phút`,
            targetTotal: targetMinutes,
            listening: `${targetListeningMinutes} phút`,
            reading: `${targetReadingMinutes} phút`,
            ratio: "2:1",
        });

        // 5. Random Listening exams (ưu tiên không vượt 190 phút tổng)
        let currentListeningMinutes = 0;
        const availableListening = [...listeningExams]; // Copy để không modify original

        while (availableListening.length > 0) {
            // Kiểm tra có thể thêm đề listening ngắn nhất không
            const shortestExam = availableListening.reduce((shortest, exam) =>
                exam.duration < shortest.duration ? exam : shortest
            );

            const currentTotal = selectedExams.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );
            const totalAfterAddingShort = currentTotal + shortestExam.duration;

            // Nếu thêm đề ngắn nhất cũng vượt limit thì dừng
            if (totalAfterAddingShort > maxTargetMinutes) {
                console.log(
                    `🛑 Stopping listening selection - even shortest exam (${shortestExam.duration}min) would exceed ${maxTargetMinutes}min limit`
                );
                break;
            }

            // Nếu đã đủ target listening minutes thì dừng
            if (currentListeningMinutes >= targetListeningMinutes) {
                console.log(
                    `✅ Listening target reached: ${currentListeningMinutes}/${targetListeningMinutes} minutes`
                );
                break;
            }

            const weights = availableListening.map((exam) =>
                calculateWeight(exam.id, userData.examStats)
            );
            const selectedExam = weightedRandom(availableListening, weights);

            if (!selectedExam) break;

            // Kiểm tra không vượt quá giới hạn (tổng <= 190 phút)
            const totalAfterAdding = currentTotal + selectedExam.duration;

            if (totalAfterAdding > maxTargetMinutes) {
                console.log(
                    `⚠️ Skipping ${selectedExam.id} - total would be ${totalAfterAdding}/${maxTargetMinutes} minutes`
                );
                // Loại bỏ đề này và thử đề khác
                const index = availableListening.findIndex(
                    (exam) => exam.id === selectedExam.id
                );
                availableListening.splice(index, 1);
                continue;
            }

            selectedExams.push(selectedExam);
            currentListeningMinutes += selectedExam.duration;

            // Loại bỏ đề đã chọn
            const index = availableListening.findIndex(
                (exam) => exam.id === selectedExam.id
            );
            availableListening.splice(index, 1);
        }

        // 6. Random Reading exams (ưu tiên không vượt 190 phút tổng)
        let currentReadingMinutes = 0;
        const availableReading = [...readingExams]; // Copy để không modify original

        while (availableReading.length > 0) {
            // Kiểm tra có thể thêm đề reading ngắn nhất không
            const shortestExam = availableReading.reduce((shortest, exam) =>
                exam.duration < shortest.duration ? exam : shortest
            );

            const currentTotal = selectedExams.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );
            const totalAfterAddingShort = currentTotal + shortestExam.duration;

            // Nếu thêm đề ngắn nhất cũng vượt limit thì dừng
            if (totalAfterAddingShort > maxTargetMinutes) {
                console.log(
                    `🛑 Stopping reading selection - even shortest exam (${shortestExam.duration}min) would exceed ${maxTargetMinutes}min limit`
                );
                break;
            }

            // Nếu đã đủ target reading minutes thì dừng
            if (currentReadingMinutes >= targetReadingMinutes) {
                console.log(
                    `✅ Reading target reached: ${currentReadingMinutes}/${targetReadingMinutes} minutes`
                );
                break;
            }

            const weights = availableReading.map((exam) =>
                calculateWeight(exam.id, userData.examStats)
            );
            const selectedExam = weightedRandom(availableReading, weights);

            if (!selectedExam) break;

            // Kiểm tra không vượt quá giới hạn (tổng <= 190 phút)
            const totalAfterAdding = currentTotal + selectedExam.duration;

            if (totalAfterAdding > maxTargetMinutes) {
                console.log(
                    `⚠️ Skipping ${selectedExam.id} - total would be ${totalAfterAdding}/${maxTargetMinutes} minutes`
                );
                // Loại bỏ đề này và thử đề khác
                const index = availableReading.findIndex(
                    (exam) => exam.id === selectedExam.id
                );
                availableReading.splice(index, 1);
                continue;
            }

            selectedExams.push(selectedExam);
            currentReadingMinutes += selectedExam.duration;

            // Loại bỏ đề đã chọn
            const index = availableReading.findIndex(
                (exam) => exam.id === selectedExam.id
            );
            availableReading.splice(index, 1);
        }

        const currentTotalDuration = selectedExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );
        console.log("📊 Selected exams:", {
            listening: `${currentListeningMinutes} phút`,
            reading: `${currentReadingMinutes} phút`,
            total: `${currentTotalDuration} phút`,
            targetRange: `${minTargetMinutes}-${maxTargetMinutes} phút`,
            withinRange:
                currentTotalDuration >= minTargetMinutes &&
                currentTotalDuration <= maxTargetMinutes
                    ? "✅"
                    : "❌",
        });

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

        // 8. Sort theo thứ tự Part để dễ ôn (Part 1→2→3→4→5→6→7)
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

        // 9. Tạo danh sách DailyExamStatus
        const dailyExams: DailyExamStatus[] = selectedExams.map((exam) => ({
            examId: exam.id,
            isCompleted: false,
            assignedDate: today,
        }));

        // 10. Cập nhật database
        const totalDuration = selectedExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );
        const examIds = selectedExams.map((exam) => exam.id);

        // Cập nhật dữ liệu user với daily exams mới
        const currentDate = getVietnamDate();

        // Lưu carry-over từ ngày trước
        const uncompletedExams = userData.dailyExams
            ? userData.dailyExams
                  .filter((exam) => !exam.isCompleted)
                  .map((exam) => exam.examId)
            : [];

        userData.currentDate = currentDate;
        userData.dailyExams = dailyExams;
        userData.carryOverExams = uncompletedExams;

        await updateUserData(userData);
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
