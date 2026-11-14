# ADR-0001 · Android và iPhone

Bản đầu dùng Android native cho lịch, widget và thông báo. Màn hình luyện tập là các tệp web được đóng gói sẵn trong APK và được phục vụ dưới dạng PWA trên iPhone. Android giữ toàn bộ lịch và câu hiện tại trong bộ nhớ ứng dụng. WebView mở nội dung đóng gói và chặn tải mạng. PWA dùng service worker để đọc câu khi ngoại tuyến.

PRD đề xuất Flutter và Next.js. Máy phát triển đã có Android SDK và Gradle. Màn hình hiện tại cần một câu, gợi ý, bộ đếm và ghi chú, nên dùng chung HTML/CSS/JS cho bản đầu để thử nội dung và bố cục ở cả hai nền tảng. Nếu màn hình native sau này cần tương tác phức tạp, vẫn có thể thay phần hiển thị và giữ widget, lịch và mã câu.

Android dùng alarm gần đúng, gán một ID câu bằng một lần ghi trạng thái theo mốc rồi phát thông báo. Nếu hệ điều hành đánh thức máy ngoài khung giờ, app chờ mốc tiếp theo. Việc gửi theo lịch trên iPhone thuộc backend Web Push. Phần này sẽ được kiểm thử với PWA cài từ Safari trên iPhone thật.

Tiếng Nhật là ngôn ngữ luyện tập. Câu hiển thị có bản dịch tiếng Việt nhỏ hơn theo mặc định. Nội dung dùng mã câu ổn định để thông báo mở đúng câu đã hiển thị.
