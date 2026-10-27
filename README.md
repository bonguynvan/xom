# Xóm Peti

Một xóm Việt Nam những năm 90 nhìn từ trên cao, kiểu tranh cuộn (hay bản đồ Đế Chế): đường tàu, phố chính
hơi cong với trà đá, sửa xe, tạp hóa, phở…, ngõ ngoằn ngoèo, nhà ống san sát, chợ, sân đình, ao làng, giếng,
bến xe lam. Hơn 100 người, con vật và cả dàn nhân vật Đua Vịt sang chơi, mỗi người một cuộc sống, đi lại và
trò chuyện ngẫu nhiên; loa phường lúc 6 giờ sáng, tàu chạy qua theo giờ. Không có thắng thua, cứ ngồi xem thôi.

Một phần của hệ sinh thái [Peti](https://peti.vn), cùng phong cách với [Đua Vịt Peti](https://duavit.peti.vn).
Địa chỉ: **https://xom.peti.vn**

## Chơi thế nào

Chủ yếu để xem. Kéo để nhìn quanh xóm, lăn chuột (hoặc chụm hai ngón, phím + −) để phóng to; để yên
vài giây thì camera tự đi dạo. Xóm chạy theo giờ thật Việt Nam (UTC+7); thêm `?tua=60` vào địa chỉ để
tua nhanh (một phút trong xóm mỗi giây). Mỗi ngày một "hạt giống" ngẫu nhiên mới.

## Chạy trên máy

```bash
npm start   # http://127.0.0.1:3500 (máy chủ tĩnh nhỏ, cùng CSP với bản thật)
npm test    # node:test, không cần cài gì
```

Không có bước build, không có thư viện ngoài: ES modules thuần + canvas.

## Cấu trúc

| File | Việc |
|------|------|
| `public/js/world.js` | Mô phỏng thuần (immutable): `createWorld`, `stepWorld` bước cố định 50 ms; mọi ngẫu nhiên đi qua `noise(seed, …)` nên cùng seed là cùng một ngày. Lịch tàu `trainAt(minute)` |
| `public/js/cast.js` | Cư dân: tên, tính cách, câu nói, nơi hay lui tới, khuôn mặt |
| `public/js/map.js`, `places.js` | Bản đồ: đường cong, ngõ ngoằn ngoèo, tìm đường (`routeNodes`); hàng quán, chợ, đình, ao…, nhà ống tự mọc dọc ngõ |
| `public/js/duavit-cast.js` | Toàn bộ nhân vật Đua Vịt sang xóm chơi, đi lang thang khắp ngõ |
| `public/js/people90*.js`, `body.js`, `face.js` | Vẽ nhân vật thập niên 90 |
| `public/js/duavit/` | Một số hình vẽ mượn từ Đua Vịt Peti (xem `public/js/duavit/VENDORED.md`) |
| `public/js/facade.js`, `street-life.js` | Chất Việt Nam: tường vôi vàng, cửa chớp, chuồng cọp, cờ, biển viết tay; xe Cub đỗ vỉa hè, quán cóc, băng rôn, cổng xóm, lũy tre, cò |
| `public/js/buildings.js`, `scenery.js`, `render.js` | Nhà (mặt tiền + mái), mặt đất, tàu, chợ, đình, ao, cây, đèn; ánh sáng theo giờ, bong bóng thoại |
| `public/js/camera.js`, `main.js` | Camera (kéo, phóng to), vòng lặp |
| `scripts/serve.js`, `live.js` | Máy chủ Node nhỏ: file game, đếm người đang xem (`/api/live`), số liệu cho admin.peti.vn |
| `deploy/` | Docker + khối site cho Caddy dùng chung (xem `deploy/README.md`) |

## Thêm một cư dân

1. Vẽ painter trong `public/js/people90*.js` (quay mặt sang phải, gốc ở mặt đất, cao khoảng 100 đơn vị,
   **không có chữ** vì nhân vật bị lật gương khi đi sang trái).
2. Thêm vào `PAINTERS` (`public/js/painters.js`) và một mục trong `CAST` (`public/js/cast.js`).
3. `npm test`, rồi mở trang xem thử cả ngày lẫn đêm.

Nhân vật có thể kỳ quặc, buồn cười, nhưng không chế giễu nhóm người thật và không dùng từ ngữ cờ bạc.

## Đóng góp

Ai cũng đóng góp được: câu thoại, nhân vật, góc phố… Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

MIT, xem [LICENSE](LICENSE).
