# Đóng góp cho Xóm Peti

Cảm ơn bạn ghé xóm! Mọi đóng góp đều quý: một nhân vật dị, một câu thoại đúng chất ngày xưa, một góc phố,
một lỗi nhỏ được sửa.

## Chạy thử

```bash
npm start          # http://127.0.0.1:3500  (thêm ?tua=60 để xem cả ngày trôi nhanh)
npm test           # node:test, không cần cài gì
```

## Những thứ dễ đóng góp nhất

- **Câu thoại**: `lines` trong `public/js/cast.js`, `GREETINGS`, `QUARRELS` (đụng nhau cãi nhau), `LOA_PHUONG`.
  Tiếng Việt đời thường, càng đúng chất những năm 90 càng tốt.
- **Nhân vật mới**: một mục trong `CAST` (`public/js/cast.js`): tên, tính cách, câu nói, nơi hay lui tới, màu áo.
  Model 3D mới (rig Mixamo, `.glb`) bỏ vào `public/models/` rồi chạy `node scripts/unpack-glb.js`.
- **Nhạc**: chỉnh bản nhạc trong `public/js/music-score.js` (hợp âm, giai điệu, tâm trạng theo giờ), hoặc góp một
  bản nhạc không lời bạn có quyền dùng dưới dạng `public/music/lofi.mp3` (ghi rõ nguồn và giấy phép trong PR).
- **Chi tiết phố xá**: `public/js/3d/buildings3d.js` (nhà), `public/js/3d/props.js`, `public/js/3d/textures.js`, `public/js/street-life.js`.

## Quy ước

- Không dùng từ ngữ cờ bạc (có test chặn), không chế giễu nhóm người thật. Nhân vật kỳ quặc thì thoải mái.
- Không `innerHTML`, không style/script inline (CSP chặn). Không thêm thư viện ngoài.
- Mô phỏng (`public/js/world.js`) phải thuần: không sửa object cũ, mọi ngẫu nhiên đi qua `noise(seed, …)`.
- `npm test` xanh trước khi gửi PR; với thay đổi giao diện, kèm ảnh chụp cả máy tính lẫn điện thoại.
