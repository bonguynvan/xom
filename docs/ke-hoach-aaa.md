# Kế hoạch "đi dạo trong xóm" (PHASE 0: đo đạc và kế hoạch, 2026-11-11)

Bản 2D đã bỏ (quyết định 2026-11-11): trang chủ `/` là bản 3D, `/3d.html` chuyển hướng 301 về `/`.
`?live=1` và "Về xóm" (`/api/join`) đã được dựng lại cho bản 3D ở PHASE 1.

## 1. Công cụ đo

- `?perf=1` (`public/js/3d/perf.js`): fps, ms mỗi khung, CPU ms (trung bình, p95, tệ nhất trong 120 khung),
  số lần vẽ, tam giác, texture, geometry, heap JS (chỉ Chrome). Đếm cả các lượt vẽ phụ (bóng đổ, mặt ao).
- `node scripts/shot.js --gpu --size 1280x720 --frames 400 "/?gio=9" …`: chụp ảnh và in số đo thành JSON
  (điều khiển Chrome qua DevTools, không cần thư viện). Bỏ `--gpu` thì dùng swiftshader (chỉ để lấy ảnh).

## 2. Số đo gốc

Máy đo: Apple M4, Chrome 157 headless, ANGLE Metal, 1280×720, tỉ lệ điểm ảnh 1, sau 400 khung.
**Mạnh hơn máy mục tiêu (M1 / Iris Xe)**, nên CPU ms ở đây là mức thấp nhất có thể; chưa đo trên M1, Iris Xe hay Android.
fps bị chặn ở 60 theo màn hình nên không nói lên dư địa; hãy nhìn CPU ms.

| Cảnh | CPU ms (p95) | Lần vẽ | Tam giác | Texture | Geometry |
|------|-------------:|-------:|---------:|--------:|---------:|
| Toàn cảnh, 9 giờ (`?gio=9`) | 5,96 (6,5) | 445 | 3,01 M | 180 | 195 |
| Đi dạo, 9 giờ (`?gio=9&che=di`) | 6,67 (7,3) | 397 | 3,02 M | 170 | 148 |
| Toàn cảnh, 18 giờ | 5,09 (5,9) | 255 | 1,56 M | 179 | 187 |
| Toàn cảnh, 21 giờ | 4,87 (5,6) | 259 | 1,31 M | 179 | 184 |
| Mưa, 9 giờ | 5,70 (6,6) | 447 | 2,87 M | 180 | 195 |
| Đêm mưa (`?gio=21&troi=rain`) | 4,79 (5,6) | 258 | 1,29 M | 179 | 183 |
| Đêm mưa, đi dạo | 5,57 (6,4) | 200 | 1,29 M | 167 | 135 |
| `?chatluong=thap`, 9 giờ | 5,69 (6,7) | 445 | 3,01 M | 180 | 196 |

Ngân sách mức "cao": CPU ≤ 6 ms, ≤ 300 lần vẽ, ≤ 1,5 M tam giác. **Ban ngày đang vượt cả ba** ngay trên M4.

Nhận xét:
- Ban ngày gấp đôi ban đêm cả về lần vẽ lẫn tam giác. Suy đoán (chưa tách ra đo): lượt vẽ bóng mặt trời vẽ lại
  gần như cả xóm (bản đồ bóng 2048 phủ theo tiêu điểm), cộng đám đông ban ngày.
- `?chatluong=thap` hiện chỉ giảm khử răng cưa và độ phân giải, không giảm hình học: chưa phải một mức chất lượng thật.
- Heap JS dao động 85–490 MB giữa các lần tải trong cùng một tiến trình; số này của Chrome không đáng tin để kết luận
  rò rỉ. Cần bài đi dạo 10 phút nhìn `renderer.info.memory` (làm ở PHASE 2).
- Tải lần đầu: `public/` 7,5 MB (model 5,2 MB, three.js 0,69 MB, texture 0,88 MB): còn trong mức 12 MB.

## 3. Mức chất lượng

| | Thấp | Vừa | Cao | Tối đa |
|---|---|---|---|---|
| Độ phân giải | ≤ 1,0 | ≤ 1,5 | ≤ 2,0 | ≤ 2,0 |
| Bóng đổ | bóng tròn dưới chân | 1 bản đồ 1024, 40 m | 3 tầng (CSM) 2048 | 4 tầng, mềm |
| Khử răng cưa | không | FXAA | SMAA | SMAA |
| Hậu kỳ | chỉnh màu | + bloom | + GTAO nửa độ phân giải, hạt phim | GTAO đủ, phản chiếu vũng nước |
| Người có xương | 12 | 30 | 60 | 90 |
| Chi tiết gần (nội thất, ban công) | không | 15 m | 25 m | 40 m |
| Mặt ao | phẳng | phản chiếu 256 | phản chiếu 512 | 1024 |
| Mục tiêu | 30 fps Android tầm trung | 60 fps laptop cũ | 60 fps M1 / Iris Xe | máy có card rời |

Tự chọn lúc mở trang: `pointer: coarse` hoặc `deviceMemory ≤ 4` → Thấp; tên GPU (`WEBGL_debug_renderer_info`)
chứa Intel HD/UHD, Mali, Adreno 5xx/6xx, PowerVR → Vừa; Apple M, Iris Xe, card rời → Cao. Sau đó tự điều chỉnh:
CPU p95 > 12 ms trong 3 giây thì hạ một mức, < 5 ms trong 20 giây thì nâng một mức (không vượt mức tự chọn + 1).
Menu "⚙️ Cài đặt": Tự động / Thấp / Vừa / Cao / Tối đa, tắt rung camera, tắt đổi góc nhìn khi chạy; lưu ở
`localStorage`. `?chatluong=thap|vua|cao|toida` vẫn ép được (giữ `thap` như cũ).

## 4. Tài sản theo từng phase

Chưa tải thứ gì ở PHASE 0. "Anh cấp" = chỉ anh mới có hoặc cần anh duyệt nguồn.

| Phase | Tài sản | Nguồn đề xuất | Giấy phép | Dung lượng / ngân sách | Anh cấp? |
|---|---|---|---|---|---|
| 1 | 6–8 nhân vật thay cho Soldier/Michelle | Quaternius "Universal Base Characters" + "Modular" (CC0), đổi màu áo bằng vật liệu | CC0 | ≤ 250 KB/nhân vật, ≤ 6 k tam giác, 1 atlas 512 | Không; nhân vật đúng chất Việt 1990 thì **có** |
| 1 | Nón lá, mũ cối, mũ phớt, 1 phụ kiện | Tự dựng bằng mã (hình nón, bán cầu) | của dự án | 0 KB | Không |
| 1 | Hoạt ảnh idle, vẫy tay | Quaternius "Universal Animation Library" (CC0) | CC0 | chung 1 file ≤ 1,2 MB cho phase 1–2 | Không |
| 2 | walk, jog, run, start, stop, turn, sit, stand-up, idle-fidget | cùng thư viện trên | CC0 | nằm trong 1,2 MB trên | Không |
| 3 | Addon three.js: EffectComposer, RenderPass, ShaderPass, OutputPass, GTAOPass, UnrealBloomPass, SMAAPass, CSM | `three@0.170.0` examples/jsm | MIT | ≈ 120 KB | Không |
| 3 | Vật liệu PBR: vôi bong, rêu, gạch lá nem, nhựa đường, tôn | Vẽ bằng mã (canvas → normal/roughness), bổ sung ambientCG nếu thiếu | của dự án / CC0 | 0 KB hoặc ≤ 1,5 MB (512–1024, JPG) | Không |
| 3 | Decal quảng cáo, tờ rơi, số nhà | Vẽ bằng mã, chữ tự đặt, **không** nhãn hiệu thật | của dự án | 0 KB | Không |
| 4 | Đồ nội thất quán, ban công, lồng chim, chậu cây | Dựng bằng mã như `props.js` hiện nay | của dự án | 0 KB | Không |
| 4 | Âm thanh: xe máy, còi, rao hàng, chim, mưa trên tôn, bước chân | Tổng hợp bằng Web Audio; tiếng rao có lời thì cần bản thu | của dự án / CC0 (freesound, chỉ lọc CC0) | 0 KB hoặc ≤ 600 KB (ogg) | Tiếng rao thật: **có** |
| 5 | Dáng ngồi xe, đạp xe, gánh hàng, mặc cả | thư viện CC0 trên; thiếu thì tự đặt khung xương bằng mã | CC0 | ≤ 400 KB | Không |
| 5 | Nhân vật Đua Vịt bản 3D | hỏi anh trước khi làm | | | **Có** |
| 6 | Không có tài sản | | | | |

Tổng thêm dự kiến: ≈ 2,5–4 MB, mỗi phase dưới 3 MB. Nén Draco/KTX2/meshopt cần WASM (`'wasm-unsafe-eval'` trong
CSP): **không dùng**; ở cỡ này lợi chừng 1–2 MB, không đáng đổi CSP.

Giấy phép hiện có: Soldier và Michelle là nhân vật Mixamo (Adobe) lấy từ ví dụ three.js. Điều khoản Mixamo cho dùng
trong sản phẩm nhưng **không cho phát hành lại file gốc**; repo này công khai nên đang ở vùng xám. Thay bằng CC0 ở
PHASE 1 là hết vướng.

## 5. Rủi ro

1. **Ngân sách đã vượt trước khi thêm gì.** Việc đầu của PHASE 3 (hoặc sớm hơn nếu anh muốn): tách đo từng lượt vẽ,
   bóng đổ chỉ quanh người chơi, đám đông xa không đổ bóng, gộp vật liệu, cắt theo khoảng cách.
2. **Trình duyệt không có** ray tracing, virtual geometry, streaming texture; WebGL2 không có compute. Thay bằng:
   GTAO + bloom + CSM + phản chiếu phẳng cho vũng nước, LOD thủ công, vẽ texture bằng mã.
3. **Hậu kỳ trên điện thoại** tốn băng thông bộ nhớ: mức Thấp không có composer, chỉ chỉnh màu trong shader.
4. **Nhân vật**: không có sẵn model "người Việt 1990" với giấy phép rõ. Nhân vật CC0 + nón lá/mũ cối + màu áo sẽ
   đúng dáng nhưng không đúng mặt; muốn hơn thì cần anh cấp model.
5. **Trượt chân < 5 cm** phụ thuộc clip; thư viện CC0 có root motion không đều, phải đo tốc độ bàn chân từng clip.
6. **Khoá con trỏ và tay cầm** khác nhau giữa Safari iOS và Chrome; cần anh thử trên máy thật, headless không thử được.
7. **PHASE 6** đụng giao thức `live.js` (thêm `/api/move`): phải hỏi anh trước, và tải SSE tăng theo số người × 10 Hz.
8. **Luồng "Về xóm"** nằm trong `main.js` cũ (đã xoá): PHASE 1 dựng lại từ lịch sử git, giữ nguyên khoá
   `xom.guest` và dạng dữ liệu `{ name, look }`.

## 6. PHASE 1 (xong 2026-11-11): màn hình đầu, chọn nhân vật, đặt tên

Đã làm: màn hình đầu với phòng chụp nhỏ (canvas WebGL thứ hai, đèn chính ấm, đèn viền lạnh, bóng tiếp đất, bục xoay
qua lại), 8 dáng người theo `GUEST_LOOKS`, 8 màu áo, 4 kiểu đội đầu, 4 món mang theo, tên kiểm tra tức thì, tên ngẫu
nhiên, lưu `xom.guest`, "Vào tiếp", vào xóm qua `/api/join`, camera bay xuống sau vai, tay cầm (trái/phải đổi dáng,
A vào, B thoát), `prefers-reduced-motion`. Nhân vật vẫn là Soldier/Michelle (chưa tải được bộ CC0: itch.io không cho
tải bằng script, file 122 MB).

Sửa trước khi làm: nhân vật có xương chỉ còn trong 24 m quanh tiêu điểm (tối đa 30, toàn cảnh thì không có), chỉ 10
người gần nhất đổ bóng; đầu của hình người xa còn 40 tam giác; model Soldier quay mặt về −Z nên trước đây mọi nhân
vật nam đi giật lùi, đã xoay lại.

Số đo sau (Apple M4, Chrome headless, Metal, 1280×720):

| Cảnh | CPU ms (p95) trước → sau | Lần vẽ trước → sau | Tam giác trước → sau |
|------|---|---|---|
| Toàn cảnh, 9 giờ | 5,96 (6,5) → 4,12 (5,8) | 445 → 226 | 3,01 M → 0,69 M |
| Toàn cảnh, 18 giờ | 5,09 (5,9) → 3,50 (5,4) | 255 → 133 | 1,56 M → 0,42 M |
| Toàn cảnh, 21 giờ | 4,87 (5,6) → 3,25 (4,5) | 259 → 131 | 1,31 M → 0,25 M |
| Mưa, 9 giờ | 5,70 (6,6) → 4,14 (5,7) | 447 → 227 | 2,87 M → 0,63 M |
| Đi dạo, 9 giờ | 6,67 (7,3) → 5,60 (6,5) | 397 → 255 | 3,02 M → 1,51 M |
| Đi dạo, 17 giờ 30 | chưa đo → 5,10 (6,3) | → 260 | → 1,77 M |
| Đêm mưa, đi dạo | 5,57 (6,4) → 4,93 (5,7) | 200 → 144 | 1,29 M → 0,83 M |
| Màn hình đầu, 9 giờ | → 3,23 (4,5) | → 226 | → 0,69 M (chưa tính canvas phòng chụp) |

Còn vượt: đi dạo giờ tan tầm 1,77 M tam giác (ngân sách 1,5 M). Hết hẳn khi thay model nhẹ (≤ 6 k tam giác).

## 7. PHASE 2 (xong 2026-11-12): điều khiển nhân vật và camera

Toán nằm trong bốn mô-đun thuần có test (`test/controller.test.js`, 13 test): `locomotion.js`, `capsule.js`,
`camera-rig.js`, `interact.js`. `player.js` và `input.js` chỉ nối chúng với three.js và DOM.

- **Chuyển động:** gia tốc 6,5 m/s² (giảm dần khi gần tốc độ tối đa), hãm 9 m/s², tốc độ quay 11 rad/s lúc đứng và
  5,5 rad/s lúc chạy, quay gót trên 109° thì hãm lại trước. Đi 1,5 m/s, chạy chậm 2,7 (cần ảo/tay cầm), chạy 4,3.
- **Không trượt chân:** đo clip trên rig Soldier (cao 1,832 m): đi 1,733 m/s, chu kỳ 1,033 s; chạy 4,444 m/s, chu kỳ
  0,7 s; chân trái ra trước ở pha 0,19 và 0,285. `blendSpace` chọn trọng số và nhịp sao cho quãng đi được trong một
  chu kỳ bằng sải chân đã trộn; đi và chạy dùng chung một pha. Đo trên xương thật (rig nam, 0,5–4,3 m/s, cao 1,22 và
  1,7 m): trượt 0,7–2,6 cm mỗi lần chạm đất. Rig nữ mượn clip nên không có nhịp hông, phép đo đó không dùng được; sải
  chân ước từ biên độ bàn chân (0,95 lần rig nam theo chiều cao) và đã bù.
- **Máy trạng thái:** idle, fidget, walk, jog, run, start, stop, turn, sit, stand. Chỉ idle/walk/run là clip; các trạng
  thái còn lại là tư thế cộng lên xương sau mixer (nghiêng người khi xuất phát và khi dừng, nhìn quanh khi đứng lâu, lê
  chân khi xoay tại chỗ, gập hông và gối khi ngồi).
- **Va chạm:** hình tròn bán kính 0,3 m với hộp nhà và ao, chia bước ≤ 0,15 m, trượt dọc tường, lăn qua góc. Test: 40
  đường đi ghi lại × 2.500 bước (có cả khung hình rớt 100 ms, tốc độ chạy) không lần nào vào tường quá 0,1 mm.
- **Lên vỉa hè 0,14 m:** độ cao bàn chân được làm mượt (giảm chấn tới hạn 0,09 s), camera theo sau 0,14 s.
- **Camera:** tay đòn lò xo sau vai phải (lệch 0,42 m), quét một hình cầu bán kính 0,28 m với hộp nhà (có chiều cao,
  nên vượt được mái thấp); thu vào tức thì, nới ra từ từ; tự xoay về sau lưng sau 2,6 s không chạm góc nhìn (không
  làm khi chuột đang khoá hoặc khi đi về phía camera); góc nhìn rộng thêm 6° khi chạy và nhún nhẹ theo bước (tắt
  được). Test: 43.000 góc nhìn dọc 12 đường đi, ống kính không lần nào vào tường quá 3 cm.
- **Đầu vào:** khoá con trỏ (bấm vào cảnh khi đang đi), hai cần ảo, tay cầm có vùng chết 0,22.
- **Tương tác:** E chào (hàng xóm dừng, quay lại, vẫy, đáp), C ngồi ghế nhựa, đầu nhân vật quay về phía người đang nói.
- **Bỏ raycast vào lưới nhà** mỗi khung hình: CPU cảnh đi dạo 9 giờ 5,60 → khoảng 4,7 ms.

Chưa làm: IK bàn chân; clip riêng cho start/stop/turn/sit/fidget (model hiện tại chỉ có Idle/Walk/Run); người chơi
và hàng xóm vẫn đi xuyên qua nhau (PHASE 5).

## 8. PHASE 3 (xong 2026-11-12): dựng hình và chỉnh màu

- **Mức chất lượng** (`quality.js`, thuần, có test): Thấp / Vừa / Cao / Tối đa. Trang tự chọn theo máy (cảm ứng hoặc
  RAM ≤ 4 GB → Thấp; Intel HD/UHD, Mali, Adreno → Vừa; Apple M, Iris Xe, card rời → Cao; Tối đa chỉ khi tự chọn).
  `?chatluong=` ép mức; nút "✨ Hình ảnh" lưu lựa chọn ở `localStorage['xom.quality']` (áp dụng sau khi tải lại).
  Khi trang chạy dưới ~42 fps liền 3 giây thì tự bỏ bớt: AO, rồi độ phân giải, rồi bloom (không tự bật lại).
  Khác bảng ở mục 3: mức Cao giới hạn tỉ lệ điểm ảnh 1,5 (không phải 2) và 2 tầng bóng (không phải 3); Tối đa 3 tầng.
- **Hậu kỳ** (`post.js`, addon three.js): cảnh vẽ vào buffer half-float có depth texture → GTAO (đọc depth đó, không
  vẽ lại cảnh; nửa độ phân giải ở mức Cao) → bloom → pass phim (ACES, đốm sáng ấm, vùng tối ngả lạnh và không bao giờ
  đen hẳn, tối góc, hạt) → SMAA (Vừa: FXAA). Mức Thấp không có composer. Số của phần chỉnh màu nằm ở `grade.js` (thuần).
- **Bóng đổ** (`shadows.js`): CSM theo khung nhìn, tầng gần phủ ~16 m quanh người chơi. Để không vượt ngân sách: nhà
  đổ bóng bằng một khối gộp duy nhất (`house-shadows`), cột đình, cổng, đèn gộp vào các mesh chung, nhân vật có xương
  được cắt theo khung nhìn, hình người xa chỉ đổ bóng thật khi ngắm từ trên cao, còn lại có đĩa bóng dưới chân.
- **Vật liệu**: normal map và roughness map sinh từ chính hình vẽ (`relief.js`, thuần): gạch lá nem, nhựa đường, bê
  tông, ngói, tôn, vữa, mặt tiền. Vữa bong lộ hàng gạch. Shader thời tiết (`surface.js`): vệt ẩm rêu chân tường, vệt
  nước mưa trên tường, mặt đường sẫm và bóng lên khi ướt, vũng nước phản chiếu trời và đèn, gợn tròn khi mưa rơi.
- **Decal** (`decal-plan.js` thuần + `decals3d.js`, một atlas, một lần vẽ): biển số nhà men xanh (mỗi nhà một số),
  quảng cáo phun sơn, tờ rơi, vết dầu, nắp cống, lá rụng. Chữ tự đặt, không nhãn hiệu, số điện thoại bịa 6 chữ số.
- **Mưa**: ô và áo mưa cho người gần, ô cho hình người xa, tia nước bắn khi giọt chạm đất.
- **Đêm**: cửa sổ đèn dây tóc có quầng sáng, biển hiệu sáng và chập chờn, ánh tivi xanh sau cửa sổ, đèn đường mạnh hơn.

Chưa làm: phản chiếu phẳng thật cho vũng nước (hiện phản chiếu bầu trời qua environment map và đốm sáng của đèn);
contact shadow riêng (GTAO và đĩa bóng thay thế); texture scan (toàn bộ vẽ bằng mã); 4 tầng bóng mềm cho Tối đa.

## 9. PHASE 4 (xong 2026-11-12): chi tiết và âm thanh quanh người chơi

- **Quán mở cửa thật** (`buildings3d.js`): mặt tiền quán có trụ, lanh tô và một căn phòng phía sau (sàn, tường, trần),
  đêm sáng đèn. **Nội thất** (`detail-plan.js` thuần + `detail3d.js`): kệ hàng, quầy, quạt trần quay, bóng đèn, tivi,
  bàn ghế quán phở, lốp xe tiệm sửa xe, bàn máy khâu hiệu may. **Ban công**: dây phơi quần áo, lồng chim, chậu cây.
  Xe đạp dựng trước cửa một phần năm số nhà.
- **LOD và tải dần**: chi tiết chia theo ô 24 m, chỉ dựng khi lại gần (mỗi khung hình tối đa một ô), hiện trong bán kính
  theo mức chất lượng (Thấp 0, Vừa 15 m, Cao 25 m, Tối đa 40 m), ẩn khi ra xa (có vùng đệm 6 m). Decal dựng sau khung
  hình đầu. Ba tầng người: có xương (gần), ảnh nhân vật (giữa), hình khối (xa) — xem mục 10.
- **Âm thanh** (`sound-plan.js` thuần + `sound3d.js`, Web Audio, toàn bộ tổng hợp, không file thu): tiếng máy của 6 xe
  gần nhất đặt đúng vị trí (PannerNode), còi, chim ban ngày, dế ban đêm, mưa và tiếng mưa trên mái tôn gần nhất, tiếng
  chợ, tiếng rao không lời (ngũ cung), chuông và giọng loa phường (không rõ lời) khi có thông báo, bước chân đổi theo
  mặt đường (nhựa, gạch, bê tông, đất). Khi loa nói thì tiếng phố nhỏ lại. Nút "🔈 Tiếng phố" riêng, nút 🎵 không đổi.
  `?tieng=1` bật sẵn (để đo); `?live=1` cũng bật sẵn.

Chưa làm: tiếng rao có lời (cần bản thu của anh), tiếng nói thật cho loa.

## 10. PHASE 5 (xong 2026-11-12): người đi đường

- **Gần (có xương)**: ngồi lên ghế nhựa (khách ngồi quán, người mô phỏng đang đứng cạnh ghế), tay cử động và gật đầu khi
  nói chuyện, người lái xe gần (≤ 16 m) là nhân vật thật ngồi trên yên, tay cầm ghi đông, chân đạp theo vòng pedal
  (xe đạp, xích lô). Tất cả là tư thế cộng lên xương (model chỉ có Idle/Walk/Run), toán ở `crowd-plan.js`.
- **Giữa (ảnh nhân vật, `impostor.js`)**: lúc mở trang, mỗi rig được chụp từ 8 hướng × 4 pha bước + 1 dáng đứng vào một
  tấm 1024×640; mỗi người ở tầm 24–62 m là 2 tam giác trong một lần vẽ chung. Biên giữa các tầng có vùng đệm.
- **Xa**: hình khối instanced như cũ (và khi ngắm từ trên cao).
- **Tránh người chơi**: hàng xóm bị đẩy ra khỏi vòng 0,75 m quanh bạn, chỉ trên hình (`sidestep`).

Chưa làm: clip thật cho ngồi/mặc cả/đạp xe; vertex-animation texture; nhân vật Đua Vịt bản 3D (cần anh quyết).

## 11. PHASE 6 (xong 2026-11-12): thấy nhau đi lại

- **Giao thức thêm mới, không đổi cái cũ**: `POST /api/move { sid, x, y, h, a }` (đơn vị bản đồ, hướng, trạng thái).
  Máy chủ (`scripts/live.js`) kiểm: trang đã `/api/join`; số hữu hạn, trong bản đồ, trạng thái thuộc danh sách; không
  quá 45 đơn vị/giây (chạy là 28,7) trừ lần đầu hoặc sau 3 giây im lặng; mỗi trang cách nhau ≥ 60 ms; mỗi địa chỉ ≤ 45
  tin/giây (bộ đếm chỉ trong bộ nhớ, tự xoá). Sai tốc độ trả 422 kèm vị trí máy chủ đang giữ.
- **Chuyển tiếp** qua luồng SSE sẵn có: sự kiện `moves` = `[[id, x, y, h, a], …]` mỗi 100 ms khi có người di chuyển
  (250 ms khi > 500 người xem, 500 ms khi > 2000). Tin `data:` cũ thêm `x, y, h` cho khách đã có vị trí.
- **Trình duyệt** (`net-move.js` thuần, dùng chung với máy chủ): gửi 10 lần/giây khi đang đi, 1 lần/giây khi đứng; vẽ
  người khác chậm 100 ms, nội suy giữa hai tin, ngoại suy tối đa 250 ms rồi đứng yên. Thẻ tên hiện trong 70 m.
- Không lưu IP, không cookie, không tài khoản: như cũ.
