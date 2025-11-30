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

// Main function: Sinh đề thi ngẫu nhiên hàng ngày - LOGIC THEO YÊU CẦU
export const generateDailyExams = async (
    userId: string = "default"
): Promise<RandomExamResponse> => {
    try {
        console.log("🚀 BẮT ĐẦU SINH ĐỀ MỚI - LOGIC ĐÚNG YÊU CẦU");

        // 1. Lấy dữ liệu user từ Firebase
        const userData = await getUserData(userId);
        if (!userData) {
            throw new Error("User data not found");
        }

        const MIN_TOTAL = 170;
        const MAX_TOTAL = 190;

        // ==== BƯỚC 1: XỬ LÝ LISTENING (120 PHÚT TARGET) ====
        console.log("🎧 === BƯỚC 1: XỬ LÝ LISTENING ===");

        const LISTENING_TARGET = 120;
        let listeningExams: ExamItem[] = [];
        let listeningDuration = 0;

        // 1A. Thêm đề chưa hoàn thành từ ngày trước (carry-over)
        if (userData.dailyExams) {
            const uncompletedListening = userData.dailyExams
                .filter((exam) => !exam.isCompleted)
                .map((exam) => EXAM_DATA.find((e) => e.id === exam.examId))
                .filter(
                    (exam) => exam && exam.type === "Listening"
                ) as ExamItem[];

            listeningExams.push(...uncompletedListening);
            listeningDuration = listeningExams.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );

            console.log(
                `📋 Carry-over Listening: ${uncompletedListening.length} đề, ${listeningDuration}p`
            );
        }

        // 1B. Lọc đề Listening có thể chọn (chưa ôn quá limit + ưu tiên đề ôn ít)
        const availableListening = EXAM_DATA.filter(
            (exam) =>
                exam.type === "Listening" &&
                !isExamAtLimit(exam.id, userData.examStats) &&
                !listeningExams.some((selected) => selected.id === exam.id)
        ).sort((a, b) => {
            // Sort theo thứ tự ưu tiên: đề ôn ít hơn lên đầu
            const statsA = userData.examStats.find((s) => s.examId === a.id);
            const statsB = userData.examStats.find((s) => s.examId === b.id);
            const countA = statsA ? statsA.completedCount : 0;
            const countB = statsB ? statsB.completedCount : 0;
            return countA - countB; // Ôn ít lên trước
        });

        console.log(
            `🎯 Available Listening: ${availableListening.length} đề có thể chọn`
        );

        // 1C. Thêm đề Listening cho đủ ~120 phút (không quá nhiều)
        for (const exam of availableListening) {
            if (listeningDuration >= LISTENING_TARGET) break;

            // Chỉ thêm nếu không làm vượt quá 130 phút (buffer 10p)
            if (listeningDuration + exam.duration <= LISTENING_TARGET + 10) {
                listeningExams.push(exam);
                listeningDuration += exam.duration;

                const stats = userData.examStats.find(
                    (s) => s.examId === exam.id
                );
                const completedCount = stats ? stats.completedCount : 0;
                console.log(
                    `  ✅ Added: ${exam.part} ${exam.examNumber
                        .toString()
                        .padStart(2, "0")} (${
                        exam.duration
                    }p, completed: ${completedCount})`
                );
            }
        }

        // ==== BƯỚC 2: XỬ LÝ READING (60 PHÚT TARGET) ====
        console.log("📚 === BƯỚC 2: XỬ LÝ READING ===");

        const READING_TARGET = 60;
        let readingExams: ExamItem[] = [];
        let readingDuration = 0;

        // 2A. Thêm đề Reading chưa hoàn thành từ ngày trước
        if (userData.dailyExams) {
            const uncompletedReading = userData.dailyExams
                .filter((exam) => !exam.isCompleted)
                .map((exam) => EXAM_DATA.find((e) => e.id === exam.examId))
                .filter(
                    (exam) => exam && exam.type === "Reading"
                ) as ExamItem[];

            readingExams.push(...uncompletedReading);
            readingDuration = readingExams.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );

            console.log(
                `📋 Carry-over Reading: ${uncompletedReading.length} đề, ${readingDuration}p`
            );
        }

        // 2B. Lọc đề Reading có thể chọn
        const availableReading = EXAM_DATA.filter(
            (exam) =>
                exam.type === "Reading" &&
                !isExamAtLimit(exam.id, userData.examStats) &&
                !readingExams.some((selected) => selected.id === exam.id)
        ).sort((a, b) => {
            const statsA = userData.examStats.find((s) => s.examId === a.id);
            const statsB = userData.examStats.find((s) => s.examId === b.id);
            const countA = statsA ? statsA.completedCount : 0;
            const countB = statsB ? statsB.completedCount : 0;
            return countA - countB; // Ôn ít lên trước
        });

        console.log(
            `🎯 Available Reading: ${availableReading.length} đề có thể chọn`
        );

        // 2C. Thêm đề Reading cho đủ ~60 phút
        for (const exam of availableReading) {
            if (readingDuration >= READING_TARGET) break;

            // Chỉ thêm nếu không làm vượt quá 70 phút
            if (readingDuration + exam.duration <= READING_TARGET + 10) {
                readingExams.push(exam);
                readingDuration += exam.duration;

                const stats = userData.examStats.find(
                    (s) => s.examId === exam.id
                );
                const completedCount = stats ? stats.completedCount : 0;
                console.log(
                    `  ✅ Added: ${exam.part} ${exam.examNumber
                        .toString()
                        .padStart(2, "0")} (${
                        exam.duration
                    }p, completed: ${completedCount})`
                );
            }
        }

        // ==== BƯỚC 3: GỘP VÀ ĐẢM BẢO ĐỦ 7 PARTS ====
        console.log("🔄 === BƯỚC 3: GỘP VÀ KIỂM TRA ===");

        let selectedExams = [...listeningExams, ...readingExams];
        selectedExams = ensureAllParts(selectedExams);

        let currentDuration = selectedExams.reduce(
            (sum, exam) => sum + exam.duration,
            0
        );

        console.log(
            `📊 Before trim: ${currentDuration}p, ${selectedExams.length} đề`
        );

        // Đảm bảo tỷ lệ listening:reading = 2:1
        const currentListening = selectedExams
            .filter((e) => e.type === "Listening")
            .reduce((sum, e) => sum + e.duration, 0);
        const currentReading = selectedExams
            .filter((e) => e.type === "Reading")
            .reduce((sum, e) => sum + e.duration, 0);
        console.log(
            `📊 Tỷ lệ hiện tại: Listening ${currentListening}p : Reading ${currentReading}p = ${
                currentReading > 0
                    ? Math.round((currentListening / currentReading) * 10) / 10
                    : "∞"
            }:1`
        );

        // ==== BƯỚC 4: TRIM THÔNG MINH ĐỂ FIT 170-190 VÀ DUY TRÌ TỶ LỆ 2:1 ====
        console.log("✂️ === BƯỚC 4: TRIM THÔNG MINH ===");

        while (currentDuration > MAX_TOTAL && selectedExams.length > 7) {
            // Đếm số đề mỗi part
            const partsCount = new Map<string, number>();
            selectedExams.forEach((exam) => {
                partsCount.set(exam.part, (partsCount.get(exam.part) || 0) + 1);
            });

            // Tính tỷ lệ lý tưởng cho tổng hiện tại
            const idealListening = Math.floor((currentDuration * 2) / 3);
            const idealReading = currentDuration - idealListening;

            const actualListening = selectedExams
                .filter((e) => e.type === "Listening")
                .reduce((sum, e) => sum + e.duration, 0);
            const actualReading = selectedExams
                .filter((e) => e.type === "Reading")
                .reduce((sum, e) => sum + e.duration, 0);

            // Xác định loại nào cần trim
            const needTrimListening = actualListening > idealListening;
            const needTrimReading = actualReading > idealReading;

            // Tìm đề để xóa: ưu tiên loại cần trim + part có >1 đề + đề ôn nhiều
            const candidatesForRemoval = selectedExams
                .filter((exam) => {
                    const partCount = partsCount.get(exam.part) || 0;
                    return partCount > 1; // Chỉ xóa nếu part này còn >1 đề
                })
                .sort((a, b) => {
                    // Ưu tiên 1: Xóa loại cần trim
                    const aShouldTrim =
                        (needTrimListening && a.type === "Listening") ||
                        (needTrimReading && a.type === "Reading");
                    const bShouldTrim =
                        (needTrimListening && b.type === "Listening") ||
                        (needTrimReading && b.type === "Reading");

                    if (aShouldTrim !== bShouldTrim) {
                        return bShouldTrim ? 1 : -1;
                    }

                    // Ưu tiên 2: Xóa đề ôn nhiều nhất
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
                console.log("🛑 Không thể trim thêm mà không mất part");
                break;
            }

            const examToRemove = candidatesForRemoval[0];
            const indexToRemove = selectedExams.findIndex(
                (exam) => exam.id === examToRemove.id
            );
            const removedExam = selectedExams.splice(indexToRemove, 1)[0];

            console.log(
                `🗑️ Trim: ${removedExam.part} ${removedExam.examNumber
                    .toString()
                    .padStart(2, "0")} (${removedExam.type}, ${
                    removedExam.duration
                }p)`
            );

            currentDuration = selectedExams.reduce(
                (sum, exam) => sum + exam.duration,
                0
            );
        }

        // ==== BƯỚC 5: KIỂM TRA KẾT QUẢ CUỐI CÙNG ====
        const finalListening = selectedExams
            .filter((e) => e.type === "Listening")
            .reduce((sum, e) => sum + e.duration, 0);
        const finalReading = selectedExams
            .filter((e) => e.type === "Reading")
            .reduce((sum, e) => sum + e.duration, 0);
        const finalParts = [...new Set(selectedExams.map((e) => e.part))];
        const finalRatio =
            finalReading > 0
                ? Math.round((finalListening / finalReading) * 10) / 10
                : 0;

        console.log("✅ === KẾT QUẢ CUỐI CÙNG ===");
        console.log(
            `📊 Tổng: ${currentDuration}p (${MIN_TOTAL}-${MAX_TOTAL}p) - ${
                currentDuration >= MIN_TOTAL && currentDuration <= MAX_TOTAL
                    ? "✅ OK"
                    : "❌ SAI"
            }`
        );
        console.log(`🎧 Listening: ${finalListening}p`);
        console.log(`📚 Reading: ${finalReading}p`);
        console.log(
            `📈 Tỷ lệ: ${finalRatio}:1 (target 2:1) - ${
                Math.abs(finalRatio - 2) <= 0.5 ? "✅ OK" : "❌ SAI"
            }`
        );
        console.log(
            `🧩 Parts: ${finalParts.length}/7 - ${
                finalParts.length === 7 ? "✅ OK" : "❌ SAI"
            }`
        );

        // ==== BƯỚC 6: XỬ LÝ DUPLICATES VÀ SORT ====
        const uniqueExams: ExamItem[] = [];
        const seenIds = new Set<string>();

        for (const exam of selectedExams) {
            if (!seenIds.has(exam.id)) {
                seenIds.add(exam.id);
                uniqueExams.push(exam);
            }
        }

        selectedExams = uniqueExams;

        // Sort theo thứ tự Part (1→2→3→4→5→6→7)
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
            if (aIndex !== bIndex) return aIndex - bIndex;
            return a.examNumber - b.examNumber;
        });

        console.log(
            "📋 Final sorted exams:",
            selectedExams.map(
                (e) => `${e.part} ${e.examNumber.toString().padStart(2, "0")}`
            )
        );

        // ==== BƯỚC 7: LƯU VÀO FIREBASE ====
        const dailyExams: DailyExamStatus[] = selectedExams.map((exam) => ({
            examId: exam.id,
            isCompleted: false,
            assignedDate: getVietnamDate(),
        }));

        const currentDate = getVietnamDate();
        await updateUserData(
            {
                ...userData,
                currentDate,
                dailyExams,
                recentHistory: [
                    currentDate,
                    ...(userData.recentHistory || []).slice(0, 6),
                ],
            },
            userId
        );

        console.log("💾 Đã lưu vào Firebase");

        return {
            success: true,
            dailyExams,
            totalDuration: selectedExams.reduce(
                (sum, exam) => sum + exam.duration,
                0
            ),
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

// Kiểm tra và reset nếu là ngày mới - CHỈ THÔNG BÁO, KHÔNG TỰ ĐỘNG SINH
export const checkAndResetIfNewDay = async (
    userId: string = "default"
): Promise<RandomExamResponse | null> => {
    const userData = await getUserData(userId);
    if (!userData) return null;

    if (isNewDay(userData.currentDate || "")) {
        console.log(
            "🌅 New day detected - Sẵn sàng sinh đề mới (cần gọi generateDailyExams)"
        );
        // CHỈ THÔNG BÁO - KHÔNG tự động sinh đề
        return {
            success: false,
            dailyExams: [],
            totalDuration: 0,
            message: "New day detected - ready for new generation",
        };
    }

    console.log("📅 Vẫn còn cùng ngày - sử dụng đề hiện tại");
    return null;
};
