// Everyday talk in the xóm: what people say depends on the hour, where they are and the weather, on top of
// each character's own lines (cast.js). Plain, old-time, a bit rough around the edges, never about gambling.

/** Said at any hour, by anyone. */
export const ANYTIME = [
  'Giời ơi là giời!', 'Khiếp, ghê chưa!', 'Thời buổi gì không biết!', 'Chán như con gián!', 'Ối giời ơi!',
  'Biết rồi, khổ lắm, nói mãi!', 'Thôi, kệ nó đi!', 'Ai bảo không nghe!', 'Nói thế mà cũng nói!', 'Hay nhỉ!',
  'Thế mới tài!', 'Đến khổ!', 'Mệt quá đi mất!', 'Ơ kìa!', 'Ủa, sao lạ thế?', 'Thật hay đùa đấy?',
  'Để đấy tính sau!', 'Từ từ rồi khoai sẽ nhừ!', 'Nói phải củ cải cũng nghe!', 'Của rẻ là của ôi!',
  'Ăn cây nào rào cây nấy!', 'Lắm mồm thế!', 'Nhà tôi hết gạo rồi!', 'Mai phải đi đóng tiền điện!',
  'Con nhà bác ấy đỗ đại học đấy!', 'Hôm qua mất điện cả tối!', 'Ti vi nhà tôi lại rè rồi!', 'Cho xin ít nước!',
  'Đi đâu mà vội mà vàng!', 'Có ai thấy con mèo nhà tôi không?', 'Ơ, quên mang chìa khóa!', 'Lại hết diêm!',
  'Cái quạt nhà tôi kêu như máy cày!', 'Tem phiếu ngày xưa khổ lắm!', 'Thằng bé nhà tôi lại trốn học!',
  'Mua được cái xe đạp Phượng Hoàng rồi!', 'Băng cát-sét này hay phết!', 'Bao giờ mới có ti vi màu?',
];

/** By the part of the day (hours are the xóm's). */
export const BY_HOUR = {
  dawn: ['Dậy sớm thế!', 'Tập thể dục không?', 'Sương mù dày quá!', 'Gà gáy rồi đấy!', 'Đi chợ sớm cho rẻ!',
    'Nấu cơm chưa?', 'Bánh mì nóng ngon thật!', 'Đánh răng chưa đấy?', 'Lạnh tay quá!', 'Vươn vai cái nào!'],
  morning: ['Ăn sáng chưa?', 'Bát phở này đậm đà thật!', 'Đi làm muộn rồi!', 'Hôm nay họp tổ không?',
    'Chợ sáng nay đông thế!', 'Mua mớ rau muống về luộc!', 'Đưa con đi học đã!', 'Kẹt xe ở đầu ngõ kìa!',
    'Uống cốc trà đá đã!', 'Hôm nay có điện không nhỉ?', 'Đọc báo sáng chưa?', 'Muộn giờ làm rồi!'],
  noon: ['Nắng vỡ đầu!', 'Ăn trưa chưa?', 'Đi ngủ trưa thôi!', 'Trưa rồi, về nấu cơm!', 'Nóng như cái lò!',
    'Cho cốc trà đá to!', 'Trưa nay ăn gì?', 'Buồn ngủ quá!', 'Đừng có ồn, người ta ngủ trưa!', 'Mát quá, gió đâu ra thế!'],
  afternoon: ['Chiều rồi đấy!', 'Tan học chưa con?', 'Ra sân đá bóng không?', 'Chiều nay mát nhỉ!',
    'Thả diều không?', 'Đi chợ chiều đi!', 'Ăn chè không?', 'Ngồi quán tí đã!', 'Bóng đá chiều nay mấy giờ?',
    'Về nấu cơm thôi!', 'Tưới cây cái đã!', 'Cho xin cái kẹo!'],
  evening: ['Ăn cơm chưa?', 'Tối nay có phim gì?', 'Tây Du Ký chiếu rồi kìa!', 'Ra quán trà đá không?',
    'Mất điện rồi, ra ngõ ngồi cho mát!', 'Tối nay họp tổ dân phố đấy!', 'Con ơi về tắm!', 'Đi dạo tí cho tiêu cơm!',
    'Quạt mo đâu rồi?', 'Bật ti vi lên xem thời sự!', 'Muỗi nhiều quá!', 'Đánh cờ không?'],
  night: ['Khuya rồi, đi ngủ đi!', 'Bánh giò nóng đây!', 'Ai còn thức không?', 'Chó sủa gì mà sủa lắm thế!',
    'Đêm nay sáng trăng!', 'Đói quá, ăn gì bây giờ?', 'Khóa cổng chưa?', 'Suỵt, khẽ thôi!', 'Ngủ ngon nhé!',
    'Mai còn đi làm sớm!', 'Đêm rồi mà còn đi đâu?', 'Lạnh rồi đấy, mặc thêm áo vào!'],
};

/** Where they are standing or sitting. */
export const BY_PLACE = {
  cho: ['Bớt cho em đi!', 'Rau này bao nhiêu?', 'Đắt thế, cắt cổ à?', 'Cân điêu thế!', 'Thêm cho mớ hành!',
    'Mở hàng cho em đi chị!', 'Cá còn tươi không?', 'Không mua thì đừng có sờ!', 'Hôm qua còn rẻ hơn!', 'Lấy hai lạng thôi!'],
  traDa: ['Cho cốc trà đá!', 'Nghe gì chưa, nhà ông Sáu…', 'Thời sự tối qua xem chưa?', 'Bao điếu thuốc lào nào!',
    'Ghi sổ nhé bà Tư!', 'Hôm nay ai trả tiền?', 'Đội tuyển mình đá hay đấy!', 'Kẹo lạc ngon thế!'],
  quanCoc: ['Làm cốc nữa không?', 'Ngồi đây cho mát!', 'Kể nghe chuyện hôm qua đi!', 'Cho thêm đá!', 'Tính tiền đi bà ơi!'],
  pho: ['Cho bát tái chín!', 'Thêm hành không?', 'Nước dùng ngon thật!', 'Cho thêm quả chanh!', 'Ăn bát nữa không?'],
  che: ['Cho cốc chè đỗ đen!', 'Thêm đá nhé!', 'Chè bưởi hôm nay ngon!', 'Ăn chè cho mát!'],
  dinh: ['Mùng một lên đình thắp hương!', 'Cây đa này trăm tuổi rồi!', 'Hội làng năm nay to lắm!', 'Chiếu tướng!',
    'Đi nước này mới hay!', 'Ngồi gốc đa mát quá!'],
  ao: ['Câu được con nào chưa?', 'Cẩn thận ngã xuống ao!', 'Vịt bơi đẹp nhỉ!', 'Hoa sen nở rồi kìa!', 'Ao này sâu lắm đấy!'],
  gieng: ['Nước giếng mát lắm!', 'Gánh hộ một đôi!', 'Hôm nay giếng cạn rồi!', 'Rửa mặt cho tỉnh!'],
  benXe: ['Xe lam đến chưa?', 'Chờ mãi chẳng thấy xe!', 'Đi Hà Đông bao nhiêu?', 'Chật như nêm!'],
  sanChoi: ['Sút đi!', 'Vào! Vào rồi!', 'Việt vị!', 'Ăn gian!', 'Đá cho tử tế!', 'Trốn tìm đi!', 'Bịt mắt bắt dê!'],
};

/** Weather talk. */
export const BY_WEATHER = {
  rain: ['Mưa to thế!', 'Trú mưa cái đã!', 'Áo mưa đâu rồi?', 'Ngập hết cả ngõ rồi!', 'Mưa thế này ai đi chợ!',
    'Quần áo phơi chưa cất!', 'Dột hết nhà rồi!', 'Mưa ơi là mưa!', 'Ướt như chuột lột!', 'Sấm to quá!'],
  hot: ['Nóng chảy mỡ!', 'Ra ao tắm đi!', 'Nắng thế này phơi thóc được!', 'Cho cốc trà đá to!', 'Quạt hộ cái!',
    'Nóng không chịu nổi!', 'Đi tắm ao không?', 'Kem đâu, kem đâu!'],
  cold: ['Rét cắt da cắt thịt!', 'Mặc thêm áo bông vào!', 'Ngô nướng đây!', 'Rét run cầm cập!', 'Hơ tay vào bếp than!',
    'Gió mùa về rồi!'],
  fog: ['Sương mù không thấy đường!', 'Trời âm u quá!', 'Nồm ẩm khó chịu!'],
};

/** Two riders who scrape each other on the road. */
export const TRAFFIC_QUARRELS = [
  ['Đi kiểu gì thế hả?', 'Có biết đi xe không?'],
  ['Mắt để ở đâu đấy?', 'Đâm vào người ta còn to mồm!'],
  ['Xe mới mua đấy, xước rồi!', 'Xe cà tàng mà làm như xe vàng!'],
  ['Bấm còi mà không nghe à?', 'Còi to thế ai chả nghe!'],
  ['Phanh không ăn à?', 'Phanh ăn thì đã chẳng đâm!'],
  ['Đền đi!', 'Đền cái gì mà đền!'],
  ['Đường to thế mà cũng đâm!', 'Tại anh lạng lách!'],
  ['Thôi, ai về nhà nấy!', 'Lần sau cẩn thận vào!'],
];

/** Riders stuck behind others. */
export const HONKS = ['Bim bim!', 'Đi nhanh lên!', 'Tắc đường rồi!', 'Nhích lên tí!', 'Ôi giời, tắc thế!', 'Tránh ra nào!'];

/** The part of the day an hour belongs to, for BY_HOUR. */
export const partOfDay = (hour) => (hour < 5 ? 'night' : hour < 7 ? 'dawn' : hour < 11 ? 'morning' : hour < 13.5 ? 'noon'
  : hour < 17.5 ? 'afternoon' : hour < 22 ? 'evening' : 'night');

/** Catchphrases old and new, for fun (the young ones say them most; even the grannies, now and then). */
export const MEMES = [
  'Lớp 5 đến lớp 7 tao còn chưa sợ!', 'Hai triệu! Hai triệu!', 'Ối dồi ôi!', 'Còn cái nịt!', 'Toang rồi!',
  'Căng đét!', 'Gét gô!', 'Đỉnh nóc kịch trần!', 'Tới công chuyện luôn!', 'Một sự giả trân!', 'Ảo thật đấy!',
  'Hết cứu!', 'Chill phết!', 'Ủa alo?', 'Khum biết!', 'Thế thì ai chơi!', 'Mãi đỉnh!', 'Xu cà na!',
  'Chuyện nhỏ như con thỏ!', 'Đúng rồi đó!', 'Biết thế đã không!', 'Ét o ét!', 'Nói chung là căng!',
  'Đi đâu cũng gặp người quen!', 'Chơi gì chơi, đừng chơi ngu!', 'Không phải dạng vừa đâu!', 'Hơi bị đỉnh!',
  'Có làm thì mới có ăn!', 'Tốn cơm quá!', 'Đỉnh của chóp!', 'Trời ơi tin được không!', 'Ơ mây zing, gút chóp!',
];

/** More small talk: the opener, then the answer. */
export const MORE_GREETINGS = [
  ['Đi đâu mà vội thế?', 'Đi đằng này một tí!'], ['Hôm nay không đi làm à?', 'Nghỉ phép rồi!'],
  ['Con bé nhà bác lấy chồng chưa?', 'Chưa, kén cá chọn canh lắm!'], ['Tối qua mưa to nhỉ!', 'Dột hết cả nhà!'],
  ['Cho vay năm nghìn!', 'Lại vay à? Lần trước chưa trả!'], ['Dạo này làm ăn thế nào?', 'Cũng tàm tạm, đủ ăn!'],
  ['Ăn gì mà béo thế?', 'Ăn không khí thôi!'], ['Mua xe mới à?', 'Xe cũ sơn lại đấy!'],
  ['Thằng cu nhà bác thi được mấy điểm?', 'Toàn điểm mười, giống bố!'], ['Đi đâu đấy, đẹp thế?', 'Đi ăn cỗ!'],
  ['Nghe tin gì chưa?', 'Chưa, kể nghe với!'], ['Có ra đình không?', 'Tối nay có hát chèo đấy!'],
  ['Mua hộ tôi bao diêm!', 'Hết diêm rồi, mua bật lửa nhé!'], ['Xem bóng đá tối qua chưa?', 'Thua sấp mặt!'],
  ['Lớp 5 đến lớp 7 tao còn chưa sợ!', 'Thế lớp 8 thì sao?'], ['Hai triệu! Hai triệu!', 'Thôi, một triệu rưỡi!'],
  ['Nhà có ai ốm không?', 'Thằng bé bị sốt, mua thuốc rồi!'], ['Hôm nay rằm à?', 'Mai mới rằm!'],
];

/** More ways a bump in the alley turns into a row. */
export const MORE_QUARRELS = [
  ['Nhìn cái gì mà nhìn?', 'Nhìn thì sao, cấm à?'], ['Ăn nói cho cẩn thận!', 'Tôi nói sai chỗ nào?'],
  ['Sao dám đá bóng vào nhà tao?', 'Bóng nó tự bay vào đấy chứ!'], ['Ai cho ngồi chỗ của tao?', 'Ghế này có ghi tên à?'],
  ['Đứng chắn hết lối đi!', 'Đường của chung chứ của riêng ai!'], ['Con nhà ai mà láo thế!', 'Con nhà bác đấy!'],
  ['Lớp 5 đến lớp 7 tao còn chưa sợ!', 'Thì giờ lớp 8 rồi đấy!'], ['Trả tiền đây!', 'Mai trả, mai trả!'],
];
