# FreeTalk trên iPhone

Cần iOS 17 trở lên. Bản thử có app và WidgetKit cỡ nhỏ hoặc vừa. Cả hai dùng cùng 100 câu tiếng Nhật và bản dịch từ bản Android. Lịch cố định 08:00–20:00, hai giờ một lần theo giờ iPhone. WidgetKit điều phối thời điểm làm mới. Âm báo “Let’s talk” dùng với thông báo cục bộ. Khi bật nhắc, app lên lịch khoảng một tuần mỗi lần mở. Bản iOS này dùng kho câu đóng gói.

## Build

GitHub Actions chạy Xcode trên macOS, kiểm tra WidgetKit đã nhúng và xuất artifact FreeTalk-iOS-unsigned. Có thể dùng Mac chạy `python3 ios/prepare.py`, rồi `xcodegen generate` trong thư mục ios.

## Cài thử

IPA từ workflow chưa ký. Cần ký cả FreeTalk.app và FreeTalkWidget.appex bằng chứng chỉ và provisioning profile hợp lệ, cho phép cài lên iPhone dùng để thử. Nếu dùng công cụ ký lại trên Windows, hãy giữ App Extensions. Sau khi ký, kết nối iPhone qua USB và dùng iDevice → Apps → Import & Install IPA trong 3uTools. Bật Developer Mode trong Cài đặt → Quyền riêng tư & Bảo mật nếu iOS yêu cầu.

Nếu dùng Xcode Personal Team, chọn cùng một team cho app và widget, rồi chạy scheme FreeTalk trực tiếp trên iPhone. Provisioning profile miễn phí hết hạn sau bảy ngày.

Mở FreeTalk một lần. Sau đó giữ màn hình chính → Sửa → Thêm widget → tìm “FreeTalk” → chọn cỡ nhỏ hoặc vừa.
