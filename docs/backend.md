# Backend FreeTalk

AWS project dùng vùng ap-southeast-2. Hạ tầng gồm HTTP API có throttling, một Lambda 192 MB, DynamoDB Standard 5 RCU và 10 WCU provisioned, CloudWatch Logs giữ 7 ngày và SSM SecureString Standard. Trước khi triển khai, kiểm tra Free plan và credit trong AWS Settings → Billing. Người dùng có thể theo dõi mức tiêu thụ tại AWS Billing and Cost Management.

Admin dùng mã truy cập dành riêng cho một người quản trị. Mã chỉ giữ trong bộ nhớ trình duyệt trong phiên hiện tại. Trong SSM có hash của mã và Gemini key. Đổi mã bằng cách chạy lại script cấu hình với tệp mã mới rồi khởi động lại phiên Lambda bằng một lần cập nhật cấu hình.

Trình sinh gọi Gemini 2.5 Flash-Lite tối đa một lần mỗi ngày theo giờ UTC+7, mỗi lượt tối đa tám câu và 2.500 token đầu ra. Lượt đã gửi đến Gemini được tính cả khi Gemini lỗi. Kho giới hạn 150 câu. Admin có thể thêm, sửa, xuất bản hoặc ẩn. Các câu mới từ Gemini vào hàng đợi bản nháp. API công khai trả về danh sách câu đã xuất bản.

Tạo template triển khai bằng `python scripts/render-template.py`. Cấu hình bí mật bằng `uv run --with boto3 --with 'botocore[crt]' python scripts/configure-backend.py <tệp-Gemini-key> <tệp-mã-admin>`. Giữ tệp mã admin trong thư mục riêng. Không đưa hai tệp này vào Git hoặc thư mục web.

Để dừng toàn bộ backend, xóa stack freetalk-japanese và tham số /freetalk-japanese/config trong ap-southeast-2. Xóa stack sẽ xóa cả kho câu.
