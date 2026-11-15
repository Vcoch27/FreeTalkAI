# FreeTalk trên iPhone

Cần iOS 17 trở lên. App dùng chung giao diện và lịch tình huống với Android và PWA. Widget có cỡ nhỏ và vừa trên màn hình chính, cùng cỡ chữ nhật trên màn hình khóa. App và widget tự đồng bộ từ cùng API, mỗi bên lưu lịch trong vùng dữ liệu của mình. iOS quyết định thời điểm chạy WidgetKit.

Trong app, Cài đặt có bản dịch, giờ nhắc, công tắc và nút thử thông báo. Chu kỳ đổi tình huống do admin đặt chung cho mọi người. Khi app đồng bộ, nó lên lịch thông báo cục bộ từ những mốc đã có trên server. Mở lại app để lấy thêm lịch. Âm báo dùng “Let’s talk”.

## Build

GitHub Actions chạy Xcode trên macOS, kiểm tra WidgetKit đã nhúng và xuất artifact FreeTalk-iOS-unsigned. Có thể dùng Mac chạy `python3 ios/prepare.py`, rồi `xcodegen generate` trong thư mục ios.

## Cài thử

IPA từ workflow chưa ký. Cần ký cả FreeTalk.app và FreeTalkWidget.appex bằng chứng chỉ và provisioning profile hợp lệ, cho phép cài lên iPhone dùng để thử. Nếu dùng công cụ ký lại trên Windows, hãy giữ App Extensions. Sau khi ký, kết nối iPhone qua USB và dùng iDevice → Apps → Import & Install IPA trong 3uTools. Bật Developer Mode trong Cài đặt → Quyền riêng tư & Bảo mật nếu iOS yêu cầu.

Nếu dùng Xcode Personal Team, chọn cùng một team cho app và widget, rồi chạy scheme FreeTalk trực tiếp trên iPhone. Provisioning profile miễn phí hết hạn sau bảy ngày.

Mở FreeTalk một lần. Trên màn hình chính, nhấn giữ → Sửa → Thêm widget → FreeTalk. Trên màn hình khóa, nhấn giữ → Tùy chỉnh → Màn hình khóa → Thêm widget → FreeTalk.
