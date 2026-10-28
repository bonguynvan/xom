# Kế hoạch đợt tới: thời tiết, nhịp ngày đêm, giờ cao điểm, câu thoại (đã làm xong, 2026-10-28)

Thứ tự đề xuất: từ nhẹ nhất (chỉ là chữ) đến nặng nhất (gọi API thời tiết). Mỗi bước làm xong là deploy được ngay.

## 1. Câu thoại bình dân, ít lặp (nhẹ nhất)

- Nâng mỗi nhóm lên vài trăm câu, chia theo **giờ** (sáng: "Ăn sáng chưa?", trưa: "Nắng vỡ đầu", tối: "Tối nay có
  phim không?", khuya), theo **chỗ** (chợ: mặc cả; quán trà đá: buôn chuyện; đình: chuyện làng) và theo **thời
  tiết** (khi có bước 4).
- **Chống lặp:** mỗi người nhớ vài câu vừa nói, không nói lại; cả xóm cũng tránh hai người nói trùng một câu
  trong một lúc. Bốc câu vẫn theo `noise(seed, …)` nên vẫn tái lập được.
- Thêm nhiều cặp chào hỏi và cãi nhau (đụng xe, tranh chỗ ngồi, trẻ con đá bóng vào nhà).

## 2. Nhịp ngày đêm (nhẹ)

- **Càng tối càng vắng:** sau 19 giờ người đi dạo về nhà dần, sau 22 giờ chỉ còn lác đác (thanh niên, người đi
  làm ca, người bán hàng đêm). Đám đông nền (ghế nhựa, chợ) cũng theo giờ như bây giờ, giảm mạnh hơn sau 22 giờ.
- **Hàng đêm:** gánh bánh giò, bánh mì đêm, xôi khuya, "ai bánh giò đêêê…" đi khắp các ngõ từ 20 giờ đến 1 giờ
  sáng; quán phở đêm, xe ôm đêm đứng đầu ngõ.

## 3. Giờ cao điểm trên phố (vừa)

- **Lưu lượng xe theo giờ:** 6:30–8:30 và 16:30–18:30 đường đông nghịt xe máy (thêm hàng trăm xe Cub, xe đạp, có
  người đội mũ cối, chở hàng, chở con), giữa trưa thưa dần, đêm còn vài xe.
- **Xe biết giữ khoảng cách:** xe sau đi chậm lại khi sát xe trước, nên giờ cao điểm tự nhiên **tắc đường**.
- **Va chạm (chỉ là hình ảnh):** thỉnh thoảng hai xe quệt nhau: cùng dừng lại, bong bóng đỏ cãi nhau ("Đi kiểu gì
  thế hả?", "Có biết đi xe không?"), người đi bộ xúm lại xem, vài giây sau ai đi đường nấy. Xe phía sau bấm còi.

## 4. Thời tiết (nặng nhất)

**Đề xuất: thời tiết chung cho cả xóm, lấy theo Hà Nội**, không theo nơi người xem ở. Lý do:
- Ai mở trang cũng thấy cùng một xóm, đúng tinh thần "cả nước cùng một xóm"; khớp với giờ Việt Nam đang dùng.
- Không phải hỏi vị trí người dùng (không xin quyền, không dính dữ liệu cá nhân).
- Máy chủ gọi API 15 phút một lần rồi gửi xuống qua kết nối đang có, dù có bao nhiêu người xem; trình duyệt không
  gọi ra ngoài nên CSP giữ nguyên.

**Nguồn:** Open-Meteo (miễn phí, không cần khóa API, dùng cho mục đích phi thương mại thì không giới hạn đáng kể;
nếu sau này có quảng cáo thì xem lại điều khoản).

**Trong xóm:**
- **Mưa:** hạt mưa rơi, mặt đất sẫm lại, vũng nước to ra, người đi đường ít hẳn (đi nhanh, trú dưới mái hiên, quán
  cóc gập ô, chợ thưa), xe máy mặc áo mưa, nhạc thêm tiếng mưa thật to.
- **Nắng to (từ 33°C):** trẻ con ra **tắm ao** (ao làng thành chỗ đông vui: đầu nhấp nhô, té nước, nhảy từ bờ),
  quán chè và trà đá đông, người già ngồi gốc đa quạt mo.
- **Rét (dưới 15°C):** áo bông, khăn len, quán ngô nướng khoai nướng, bếp than đỏ.
- **Sương sớm, trời âm u:** màu trời và ánh sáng nhạt đi.
- Admin có thể **ép thời tiết** (nút "Cho mưa", "Cho nắng") để livestream cho vui.

## Ước lượng

| Bước | Công | Ghi chú |
|------|------|---------|
| 1. Câu thoại | nhỏ | chủ yếu là chữ + chống lặp |
| 2. Ngày đêm, hàng đêm | nhỏ | lịch sinh hoạt + 1 kiểu người bán mới |
| 3. Giờ cao điểm | vừa | lưu lượng theo giờ, giữ khoảng cách, va chạm |
| 4. Thời tiết | vừa–lớn | API phía máy chủ, mưa/nắng/rét, tắm ao, nút admin |
