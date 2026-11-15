# FreeTalk 日本語

Ứng dụng nội bộ hiển thị một câu để luyện nói và brainstorming bằng tiếng Nhật. Mỗi câu có bản dịch tiếng Việt nhỏ hơn và mã hiển thị theo giờ, ngày phát. Mặc định câu đổi mỗi hai giờ từ 08:00 đến trước 22:00 theo giờ thiết bị. Ngoài khung giờ này, app giữ câu gần nhất.

## Android

Dùng JDK 17 hoặc 21, Android SDK Platform 35 và Android SDK Platform-Tools.

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat :android:assembleDebug
adb install -r android/build/outputs/apk/debug/android-debug.apk
```

Mở FreeTalk, thêm widget 4 × 2 từ màn hình chính. Vào **Cài đặt → Thử thông báo** để kiểm tra. Bật nhắc trong cài đặt nếu muốn nhận thông báo tự động. Widget vẫn đổi câu khi tắt nhắc. Android có thể dời cập nhật nền khi tiết kiệm pin. Khi chạm vào thông báo, app mở câu cùng mốc giờ gắn với thông báo đó.

## Web và iPhone

Mở [bản web](https://freetalk-japanese-preview.vercel.app/) hoặc chạy `npm run dev` và mở http://127.0.0.1:4173/. Trên iPhone, dùng Safari và chọn **Chia sẻ → Thêm vào màn hình chính**. Câu đổi theo lịch khi app đang mở hoặc khi quay lại. Sau khi tải lần đầu, có thể đọc câu ngay cả khi mất mạng.

Bản cài có 100 câu mẫu, gồm 85 câu đời sống và 15 câu công việc. Android và web chọn câu từ kho đã tải theo lịch riêng. Xem [cách quản lý kho câu và theo dõi AWS](docs/content-workflow.md). Xem [quyết định nền tảng](docs/decisions/ADR-0001-platform-strategy.md) để biết cách hai bản chia sẻ nội dung.
