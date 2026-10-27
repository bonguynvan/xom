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
- **Nhân vật mới**: vẽ painter trong `public/js/people90*.js` (quay mặt sang phải, gốc ở mặt đất, cao khoảng
  100 đơn vị, **không có chữ** vì nhân vật bị lật gương khi đi sang trái), thêm vào `PAINTERS`
  (`public/js/painters.js`) và một mục trong `CAST`.
- **Chi tiết phố xá**: `public/js/facade.js` (mặt tiền nhà), `public/js/street-life.js`, `public/js/decor.js`.

## Quy ước

- Không dùng từ ngữ cờ bạc (có test chặn), không chế giễu nhóm người thật. Nhân vật kỳ quặc thì thoải mái.
- Không `innerHTML`, không style/script inline (CSP chặn). Không thêm thư viện ngoài.
- Mô phỏng (`public/js/world.js`) phải thuần: không sửa object cũ, mọi ngẫu nhiên đi qua `noise(seed, …)`.
- `npm test` xanh trước khi gửi PR; với thay đổi giao diện, kèm ảnh chụp cả máy tính lẫn điện thoại.
