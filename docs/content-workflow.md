# Kho câu FreeTalk

Android và PWA tự chọn câu tiếp theo từ kho đã tải vào máy. Mặc định mỗi hai giờ trong khung 08:00–22:00 theo giờ thiết bị. Android có thể phát thông báo cục bộ trong nền; PWA đổi câu khi đang mở hoặc khi mở lại. Một lần đổi câu không yêu cầu một lần gọi AWS.

## Thêm và phát câu

1. Đăng nhập web admin và điền yêu cầu bổ sung, nếu có.
2. Sao chép prompt sang công cụ AI bạn chọn, rồi dán mảng JSON vào admin.
3. Nhập lô vào bản nháp. Kiểm tra tiếng Nhật, bản dịch và nhóm câu trước khi xuất bản từng câu hoặc cả lô.
4. Chọn nhóm Đời sống, Công việc hoặc Tất cả. Chọn thứ tự cũ đến mới, mới đến cũ hoặc xáo trộn rồi lặp. Dùng trường Vị trí trong kho khi sửa câu để đổi thứ tự thủ công.
5. App đã mở một câu thì giữ câu đó đến mốc kế tiếp. Cấu hình mới có hiệu lực sau khi đồng bộ kho.

Bản cài có 100 câu mẫu, gồm 85 câu đời sống và 15 câu công việc đơn giản. Chạy `powershell -File scripts/deploy-backend.ps1` để cập nhật backend và đưa bộ câu vào kho admin. Có thể chạy riêng `python scripts/seed-catalogue.py` nếu backend đã cập nhật. Script bỏ qua câu tiếng Nhật đã tồn tại.

## Theo dõi AWS

Chạy `powershell -File scripts/aws-usage.ps1` để xem gói, credit, usage theo dịch vụ và số lần gọi/lỗi Lambda trong bảy ngày. Dùng `aws login --profile aws-starter --region ap-southeast-2` khi phiên CLI hết hạn.

- [AWS Settings](https://settings.aws.com/) → Billing để xem credit và ngày hết hạn của project.
- [Billing and Cost Management](https://console.aws.amazon.com/billing/home) → Free Tier và Bills để theo dõi usage và chi phí toàn project.
- [CloudWatch Sydney](https://console.aws.amazon.com/cloudwatch/home?region=ap-southeast-2#metricsV2:) → Lambda → By Function Name → freetalk-japanese để xem Invocations, Errors và Throttles.

Luồng AWS hiện tại là API Gateway → Lambda → DynamoDB. SSM giữ cấu hình admin. CloudWatch giữ log Lambda trong bảy ngày. Admin tự dùng prompt nên thao tác sao chép prompt hoặc nhập lô không gọi Gemini từ Lambda. Usage của AWS bao gồm cả tài nguyên khác trong cùng project.
