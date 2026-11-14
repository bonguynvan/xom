# Xóm Peti

Một xóm Việt Nam những năm 90 dựng bằng 3D (three.js): đường tàu, phố chính
hơi cong với trà đá, sửa xe, tạp hóa, phở…, ngõ ngoằn ngoèo, nhà ống san sát, chợ, sân đình, ao làng, giếng,
bến xe lam. Hơn 100 người, con vật và cả dàn nhân vật Đua Vịt sang chơi, mỗi người một cuộc sống, đi lại và
trò chuyện ngẫu nhiên; loa phường lúc 6 giờ sáng, tàu chạy qua theo giờ. Không có thắng thua, cứ ngồi xem thôi.

Một phần của hệ sinh thái [Peti](https://peti.vn), cùng phong cách với [Đua Vịt Peti](https://duavit.peti.vn).
Địa chỉ: **https://xom.peti.vn**

## Chơi thế nào

Chủ yếu để xem, hoặc tự đi dạo trong xóm. Xóm chạy theo giờ thật Việt Nam (UTC+7), mỗi ngày một "hạt giống"
ngẫu nhiên mới. Nhà ống có cửa chớp, chuồng cọp, ban công, mái ngói, mái tôn, mái bằng có bể nước và ăng-ten; đường nhựa, vỉa hè gạch
lá nem, ngõ bê tông, đường tàu khổ một mét có chắn tàu; ao có sen, chợ có bạt, đình mái cong, cây đa, tre, chuối;
mặt trời đi theo giờ thật, bóng đổ, đèn đường và cửa sổ sáng về đêm, mưa thật khi Hà Nội mưa.

- **Màn hình đầu:** chọn dáng người, màu áo, mũ (nón lá, mũ cối, mũ phớt), một món mang theo, đặt tên rồi bấm
  **Vào xóm**: camera bay từ trên trời xuống sau vai bạn, trước cửa nhà "của bạn". Lần sau trang nhớ nhân vật cũ
  (**Vào tiếp**). Bấm **Chỉ ngắm thôi** nếu chỉ muốn xem.
- **Ngắm xóm:** kéo để xoay, chuột phải (hoặc Shift + kéo) để dời, lăn chuột để phóng to; để yên thì camera tự đi dạo.
- **Đi dạo** (nút hoặc phím F): W A S D hoặc mũi tên để đi, Shift để chạy, E chào người gần nhất (họ dừng lại, quay sang,
  vẫy tay và đáp lời), C ngồi xuống chiếc ghế nhựa còn trống gần nhất. Kéo chuột để nhìn quanh, hoặc bấm vào cảnh để khoá
  chuột (Esc thả). Điện thoại: cần trái để đi, cần phải hoặc kéo màn hình để nhìn, hai nút 👋 và 🪑. Tay cầm: cần trái đi,
  cần phải nhìn, A chào, X ngồi, B hoặc RT chạy, Start đổi chế độ. Nút "🎥 Rung máy" tắt góc nhìn rộng khi chạy và nhịp nhún.
  Trên điện thoại có cần điều khiển ảo.
- Thử nhanh: `?gio=19.5` (xem lúc 19 giờ 30), `?troi=rain` (ép mưa), `?che=di` (vào thẳng chế độ đi dạo),
  `?che=ngam` (bỏ màn hình đầu, ngắm luôn), `?chatluong=thap|vua|cao|toida` (ép mức hình ảnh; bình thường trang tự chọn theo máy, nút ✨ Hình ảnh đổi được), `?tua=60` (tua nhanh, một phút trong xóm
  mỗi giây), `?perf=1` (số đo hiệu năng).
- **Livestream:** `?live=1` làm nguồn cho OBS (Browser Source 1920×1080): không nút bấm, đồng hồ to, góc dưới ghi
  `xom.peti.vn`, nhạc tự bật.

Mô phỏng là `world.js`; phần vẽ nằm trong `public/js/3d/`. three.js r170 được chép vào
`public/js/vendor/three/` (xem `VENDORED.md`), nên vẫn không có bước build. Thêm model nhân vật mới: chép file
`.glb` (rig Mixamo) vào `public/models/` rồi chạy `node scripts/unpack-glb.js public/models/ten.glb`.

## Ngày đêm, giao thông, thời tiết

- Càng về tối càng vắng; đêm có gánh bánh giò, bánh mì đêm, xôi khuya.
- Giờ đi làm (7–8 giờ) và tan tầm (17–18 giờ) đường kín xe máy, tự tắc đường; thỉnh thoảng có vụ quệt xe, hai bên
  dừng lại cãi nhau (chỉ là hình ảnh).
- Thời tiết lấy theo trời Hà Nội (Open-Meteo, 15 phút một lần, ai cũng thấy cùng một trời): mưa thì vắng người,
  nắng to thì trẻ con ra tắm ao, rét thì ít người ngồi quán. Admin ép được thời tiết để livestream.
- Câu thoại: vài trăm câu theo giờ, theo chỗ, theo thời tiết, cả câu cửa miệng cũ lẫn mới; không ai nói lặp lại.

## Nhạc

Bấm 🎵 để nghe lofi "mùa thu Hà Nội" tự sáng tác ngay trong trình duyệt (Web Audio, không dùng bản thu nào nên không vướng bản quyền): piano điện, bass, trống nhẹ, giai điệu ngũ cung kiểu đàn bầu, tiếng đĩa than; tối có mưa, khuya có dế. Nhạc đổi theo giờ trong xóm. Muốn dùng bản nhạc khác, bỏ file `public/music/lofi.mp3` vào (nhạc bạn có quyền dùng) là trang phát file đó thay thế.

## Chạy trên máy

```bash
npm start   # http://127.0.0.1:3500 (máy chủ tĩnh nhỏ, cùng CSP với bản thật)
npm test    # node:test, không cần cài gì
```

Không có bước build, không có thư viện ngoài: ES modules thuần + three.js chép sẵn.

## Cấu trúc

| File | Việc |
|------|------|
| `public/js/world.js` | Mô phỏng thuần (immutable): `createWorld`, `stepWorld` bước cố định 50 ms; mọi ngẫu nhiên đi qua `noise(seed, …)` nên cùng seed là cùng một ngày. Lịch tàu `trainAt(minute)` |
| `public/js/cast.js` | Cư dân: tên, tính cách, câu nói, nơi hay lui tới |
| `public/js/map.js`, `places.js`, `street-life.js`, `extras.js` | Bản đồ: đường cong, ngõ ngoằn ngoèo, tìm đường (`routeNodes`); hàng quán, chợ, đình, ao…, nhà ống tự mọc dọc ngõ; xe đỗ, quán cóc, ghế nhựa; đám đông nền theo giờ |
| `public/js/duavit-cast.js` | Toàn bộ nhân vật Đua Vịt sang xóm chơi, đi lang thang khắp ngõ |
| `public/js/music.js`, `music-score.js` | Nhạc lofi tự tạo bằng Web Audio; bản nhạc (hợp âm, giai điệu ngũ cung, tâm trạng theo giờ) |
| `scripts/serve.js`, `live.js` | Máy chủ Node nhỏ: file game, đếm người đang xem (`/api/live`), khách vào xóm (`/api/join`), vị trí khách đang đi (`/api/move`, kiểm tra rồi chuyển tiếp), số liệu cho admin.peti.vn |
| `public/js/3d/` | Phần vẽ: `coords.js` (đổi tọa độ, va chạm, mặt trời; thuần, có test), `terrain.js`, `buildings3d.js`, `trees.js`, `props.js`, `models.js`, `people3d.js` (nhân vật glTF), `player.js` + `input.js` (điều khiển và camera; toán nằm trong `locomotion.js`, `capsule.js`, `camera-rig.js`, `interact.js`, thuần, có test), `vehicles3d.js`, `sky3d.js`, `player.js` (camera, nhân vật của bạn), `main3d.js` |
| `deploy/` | Docker + khối site cho Caddy dùng chung (xem `deploy/README.md`) |

## Thêm một cư dân

1. Thêm một mục trong `CAST` (`public/js/cast.js`).
2. `npm test`, rồi mở trang xem thử cả ngày lẫn đêm (`?gio=19.5`).

Nhân vật có thể kỳ quặc, buồn cười, nhưng không chế giễu nhóm người thật và không dùng từ ngữ cờ bạc.

## Đóng góp

Ai cũng đóng góp được: câu thoại, nhân vật, góc phố… Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

MIT, xem [LICENSE](LICENSE).
