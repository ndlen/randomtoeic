# 🎯 TOEIC Random Daily - Hệ thống luyện thi TOEIC thông minh

Ứng dụng web giúp random đề thi TOEIC hàng ngày theo thuật toán thông minh, đảm bảo bao phủ đều các phần thi và tối ưu thời gian học.

## ✨ Tính năng chính

### 📱 Progressive Web App (PWA)

-   **Cài đặt được**: Có thể cài như native app trên mobile/desktop
-   **Offline support**: Hoạt động khi không có mạng
-   **Auto-update**: Tự động cập nhật phiên bản mới
-   **Push notifications**: Thông báo nhắc nhở luyện tập
-   **Fast loading**: Cache thông minh, load nhanh

### 🎲 Random thông minh

-   **Weighted Random**: Đề ít được luyện có xác suất xuất hiện cao hơn
-   **Bao phủ đầy đủ**: Đảm bảo có đề cho tất cả 7 parts mỗi ngày
-   **Tránh trùng lặp**: Không lặp lại đề trong 2-3 ngày gần nhất
-   **Cân bằng thời gian**: Listening ~120 phút, Reading ~60 phút

### 📊 Quản lý tiến độ

-   **Checkbox tracking**: Tick hoàn thành từng đề
-   **Carry-over**: Đề chưa xong tự động chuyển sang ngày mai
-   **Thống kê chi tiết**: Theo dõi số lần làm từng đề
-   **Giới hạn thông minh**: Listening max 20 lần, Reading max 10 lần

### ⏰ Reset tự động

-   **Daily reset**: Tự động tạo danh sách mới vào 0h VN
-   **Manual reset**: Có thể random lại bất cứ lúc nào
-   **History tracking**: Lưu lịch sử luyện tập

## 🏗️ Cấu trúc dữ liệu

### Đề thi có sẵn:

-   **Part 1**: 5 đề (6 phút/đề) - Listening
-   **Part 2**: 3 đề (14 phút/đề) - Listening
-   **Part 3**: 3 đề (25 phút/đề) - Listening
-   **Part 4**: 3 đề (25 phút/đề) - Listening
-   **Part 5**: 5 đề (15 phút/đề) - Reading
-   **Part 6**: 5 đề (10 phút/đề) - Reading
-   **Part 7**: 4 đề (30 phút/đề) - Reading

**Tổng**: 28 đề, ~11 giờ nội dung

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống

-   Node.js 18+
-   npm hoặc yarn
-   Firebase account

### Bước 1: Clone và cài đặt

```bash
git clone <repository-url>
cd randombaihoc
npm install
```

### Bước 2: Cấu hình Firebase

1. Tạo project mới trên [Firebase Console](https://console.firebase.google.com/)
2. Bật Firestore Database
3. Cập nhật config trong `src/firebase.ts`
4. Thiết lập Firestore Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TOEIC users collection
    match /toeic_users/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Bước 3: Chạy ứng dụng

```bash
# Development
npm run dev

# Production build
npm run build
npm run preview
```

Truy cập:

-   Dev: http://localhost:5173
-   Preview: http://localhost:4173

### Bước 4: Cài đặt PWA

1. Mở ứng dụng trên Chrome/Safari
2. Click nút **"📲 Cài đặt"** hoặc dùng menu browser
3. App sẽ được cài như native app
4. Có thể sử dụng offline!

## 📱 Hướng dẫn sử dụng

### Màn hình chính

-   **Danh sách đề hôm nay**: Hiển thị các đề được random
-   **Progress bar**: Theo dõi tiến độ hoàn thành
-   **Checkbox**: Click để đánh dấu hoàn thành
-   **Stats**: Xem tổng thời gian và số đề còn lại

### Lịch sử luyện tập

-   Click nút **"📊 Lịch sử"** để xem chi tiết
-   **Lọc theo loại**: Listening, Reading hoặc tất cả
-   **Sắp xếp**: Theo Part, số lần làm, hoặc lần cuối
-   **Color coding**: Màu sắc thể hiện mức độ luyện tập

### Reset manual

-   Click **"🔄 Reset"** để random lại đề hôm nay
-   Đề chưa hoàn thành sẽ được carry-over sang ngày mai

## ⚙️ Thuật toán Random

### Công thức trọng số:

```
Trọng số = 1 / (Số lần đã làm + 1)
```

### Logic random:

1. **Carry-over**: Thêm đề chưa xong từ hôm qua
2. **Lọc đề khả dụng**: Loại bỏ đề đạt giới hạn và trong lịch sử gần đây
3. **Phân bổ thời gian**: 67% Listening, 33% Reading
4. **Random có trọng số**: Chọn theo xác suất nghịch đảo
5. **Ensure coverage**: Bắt buộc có ít nhất 1 đề mỗi part

### Giới hạn:

-   **Listening**: 20 lần/đề → ngừng random
-   **Reading**: 10 lần/đề → ngừng random
-   **Target daily**: ~180 phút (~3 giờ)

## 🛠️ Tech Stack

-   **Frontend**: React 18 + TypeScript + Vite
-   **PWA**: vite-plugin-pwa + Workbox
-   **Database**: Firebase Firestore
-   **Styling**: CSS Modules + CSS Variables
-   **State Management**: React Hooks
-   **Build Tool**: Vite + SWC

## 📂 Cấu trúc project

```
src/
├── components/           # React components
│   ├── TOEICApp.tsx     # Main app component
│   ├── DailyExamList.tsx # Danh sách đề hôm nay
│   └── ExamHistory.tsx   # Lịch sử luyện tập
├── types.ts             # TypeScript interfaces
├── firebase.ts          # Firebase configuration
├── firebaseService.ts   # Database operations
├── randomService.ts     # Random algorithm
└── styles/
    └── TOEICApp.css     # Main stylesheet
```

## 🎯 Chiến lược luyện tập

### Mục tiêu hàng ngày:

-   **3 giờ/ngày** (180 phút)
-   **Listening ưu tiên**: ~120 phút (67%)
-   **Reading bổ sung**: ~60 phút (33%)

### Progression tracking:

-   **Beginner**: Tất cả đề đều ít lần làm
-   **Intermediate**: Một số đề đã làm 5-10 lần
-   **Advanced**: Nhiều đề đạt giới hạn, hệ thống điều chỉnh tỉ lệ

### Tips sử dụng:

1. **Làm đủ mỗi ngày**: Tick hết để có dữ liệu chính xác
2. **Check lịch sử**: Xem đề nào thiếu để focus
3. **Carry-over strategy**: Đề khó có thể để ngày mai
4. **Manual reset**: Dùng khi muốn thay đổi mix đề

## 🔧 Customization

### Thay đổi config:

Chỉnh sửa trong `src/types.ts`:

```typescript
export const DEFAULT_CONFIG: SystemConfig = {
    targetDailyMinutes: 180, // Thời gian mục tiêu
    listeningRatio: 0.67, // Tỉ lệ Listening
    readingRatio: 0.33, // Tỉ lệ Reading
    maxListeningCount: 20, // Giới hạn Listening
    maxReadingCount: 10, // Giới hạn Reading
    historyDays: 3, // Số ngày tránh trùng lặp
};
```

### Thêm đề mới:

Cập nhật mảng `EXAM_DATA` trong `src/types.ts`

## 📄 License

MIT License - Tự do sử dụng và chỉnh sửa

## 🤝 Contributing

1. Fork project
2. Tạo feature branch
3. Commit changes
4. Push và tạo Pull Request

## 📞 Support

Nếu có vấn đề hoặc đóng góp ý kiến, vui lòng tạo issue trong repository.

---

**Happy TOEIC Learning! 🚀📚**
