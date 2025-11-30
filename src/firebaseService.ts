import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { UserData, ExamStats, DailyExamStatus } from "./types";

const COLLECTION_NAME = "toeic_users";
const DEFAULT_USER_ID = "default_user";

// Khởi tạo dữ liệu user mới
export const initializeUser = async (
    userId: string = DEFAULT_USER_ID
): Promise<UserData> => {
    const defaultData: UserData = {
        userId,
        currentDate: "",
        dailyExams: [],
        examStats: [],
        recentHistory: [],
        carryOverExams: [],
    };

    const userRef = doc(db, COLLECTION_NAME, userId);
    await setDoc(userRef, defaultData);
    return defaultData;
};

// Lấy dữ liệu user
export const getUserData = async (
    userId: string = DEFAULT_USER_ID
): Promise<UserData | null> => {
    try {
        const userRef = doc(db, COLLECTION_NAME, userId);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            return docSnap.data() as UserData;
        } else {
            // Nếu chưa có data thì khởi tạo
            return await initializeUser(userId);
        }
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
};

// Cập nhật dữ liệu user
export const updateUserData = async (
    userData: UserData,
    userId: string = DEFAULT_USER_ID
): Promise<boolean> => {
    try {
        const userRef = doc(db, COLLECTION_NAME, userId);
        await setDoc(userRef, userData);
        return true;
    } catch (error) {
        console.error("Error updating user data:", error);
        return false;
    }
};

// Lấy thống kê của một bài thi cụ thể
export const getExamStats = async (
    examId: string,
    userId: string = DEFAULT_USER_ID
): Promise<ExamStats | null> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) return null;

        // Đảm bảo examStats tồn tại
        if (!userData.examStats) {
            userData.examStats = [];
        }

        const stats = userData.examStats.find((stat) => stat.examId === examId);
        return stats || { examId, completedCount: 0 };
    } catch (error) {
        console.error("Error getting exam stats:", error);
        return null;
    }
};

// Cập nhật thống kê khi hoàn thành bài thi
export const updateExamStats = async (
    examId: string,
    userId: string = DEFAULT_USER_ID
): Promise<boolean> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) return false;

        // Đảm bảo examStats tồn tại
        if (!userData.examStats) {
            userData.examStats = [];
        }

        const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
        const existingStatIndex = userData.examStats.findIndex(
            (stat) => stat.examId === examId
        );

        if (existingStatIndex >= 0) {
            // Cập nhật stats hiện có
            userData.examStats[existingStatIndex].completedCount += 1;
            userData.examStats[existingStatIndex].lastCompletedDate = today;
        } else {
            // Thêm stats mới
            userData.examStats.push({
                examId,
                completedCount: 1,
                lastCompletedDate: today,
            });
        }

        return await updateUserData(userData, userId);
    } catch (error) {
        console.error("Error updating exam stats:", error);
        return false;
    }
};

// Toggle trạng thái hoàn thành bài thi
export const toggleExamCompleted = async (
    examId: string,
    userId: string = DEFAULT_USER_ID
): Promise<boolean> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) return false;

        // Đảm bảo dailyExams tồn tại
        if (!userData.dailyExams) {
            userData.dailyExams = [];
        }

        // Tìm và toggle trạng thái hoàn thành
        const examIndex = userData.dailyExams.findIndex(
            (exam) => exam.examId === examId
        );

        if (examIndex >= 0) {
            const wasCompleted = userData.dailyExams[examIndex].isCompleted;
            userData.dailyExams[examIndex].isCompleted = !wasCompleted;

            // Đảm bảo examStats tồn tại
            if (!userData.examStats) {
                userData.examStats = [];
            }

            // Cập nhật stats: tăng khi tick, giảm khi hủy
            const today = new Date().toLocaleDateString("en-CA");
            const existingStatIndex = userData.examStats.findIndex(
                (stat) => stat.examId === examId
            );

            if (existingStatIndex >= 0) {
                // Cập nhật stats hiện có
                if (!wasCompleted) {
                    // Tăng count khi tick
                    userData.examStats[existingStatIndex].completedCount += 1;
                    userData.examStats[existingStatIndex].lastCompletedDate =
                        today;
                } else {
                    // Giảm count khi hủy (không cho phép âm)
                    userData.examStats[existingStatIndex].completedCount =
                        Math.max(
                            0,
                            userData.examStats[existingStatIndex]
                                .completedCount - 1
                        );
                }
            } else if (!wasCompleted) {
                // Thêm stats mới chỉ khi tick (không phải hủy)
                userData.examStats.push({
                    examId,
                    completedCount: 1,
                    lastCompletedDate: today,
                });
            }

            // Cập nhật recent history chỉ khi tick
            if (!wasCompleted && !userData.recentHistory.includes(examId)) {
                userData.recentHistory = [
                    examId,
                    ...userData.recentHistory,
                ].slice(0, 15);
            }
        }
        return await updateUserData(userData, userId);
    } catch (error) {
        console.error("Error toggling exam completed:", error);
        return false;
    }
};

// Lấy danh sách đề hôm nay
export const getTodayExams = async (
    userId: string = DEFAULT_USER_ID
): Promise<DailyExamStatus[]> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) return [];

        const today = new Date().toLocaleDateString("en-CA");

        // Kiểm tra xem đã reset ngày mới chưa
        if (userData.currentDate !== today) {
            return []; // Sẽ được xử lý trong logic random
        }

        return userData.dailyExams;
    } catch (error) {
        console.error("Error getting today exams:", error);
        return [];
    }
};

// Cập nhật carry-over exams
export const updateCarryOverExams = async (
    carryOverExams: string[],
    userId: string = DEFAULT_USER_ID
): Promise<boolean> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) return false;

        userData.carryOverExams = carryOverExams;
        return await updateUserData(userData, userId);
    } catch (error) {
        console.error("Error updating carry-over exams:", error);
        return false;
    }
};

// Cập nhật lịch sử gần đây
export const updateRecentHistory = async (
    newExamIds: string[],
    userId: string = DEFAULT_USER_ID
): Promise<boolean> => {
    try {
        const userData = await getUserData(userId);
        if (!userData) return false;

        // Thêm vào lịch sử và giữ lại tối đa 3 ngày gần nhất
        const updatedHistory = [...newExamIds, ...userData.recentHistory];
        userData.recentHistory = Array.from(new Set(updatedHistory)).slice(
            0,
            15
        ); // Khoảng 15 đề gần nhất

        return await updateUserData(userData, userId);
    } catch (error) {
        console.error("Error updating recent history:", error);
        return false;
    }
};
