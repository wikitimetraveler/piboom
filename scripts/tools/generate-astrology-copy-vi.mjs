/**
 * One-shot generator for astrology-copy-vi.js
 * Development work by David Lane
 */
import { writeFileSync, readFileSync } from 'fs';
import vm from 'vm';
import { join } from 'path';

const root = process.cwd();
const code =
  readFileSync(join(root, 'public/entertainment/js/astrology-zodiac.js'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'public/entertainment/js/astrology-arcana.js'), 'utf8');
const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(code, sandbox);
const A = sandbox.AstrologyArcana;

const SIGN_VI = {
  aries: {
    name: 'Bạch Dương',
    symbol: 'Cừu đực',
    kicker: 'Tia lửa đầu năm.',
    traits: ['mạnh mẽ', 'khởi đầu', 'thẳng'],
    blurb:
      'Bạch Dương đá bánh xe. Sừng vàng, nghiêng về phía trước, và dũng khí bắt đầu trước khi bản đồ hoàn tất.',
    oracle:
      'Rose lật mặt cừu đực. Bắt đầu trước khi bạn cảm thấy sẵn sàng. Phòng khách thưởng bước đầu sạch hơn bản đồ hoàn hảo.',
    shadow: 'Nóng mà không có cửa — bạn có thể đốt căn phòng bạn định sưởi.',
    gift: 'Dũng khí để bắt đầu.',
  },
  taurus: {
    name: 'Kim Ngưu',
    symbol: 'Bò đực',
    kicker: 'Sang trọng chậm, đất chắc.',
    traits: ['vững', 'cảm giác', 'trung thành'],
    blurb:
      'Kim Ngưu giữ vườn. Chữ V của sao, khẩu vị kiên nhẫn, và món quà khiến căn phòng như nhà.',
    oracle:
      'Rose đặt bò trên nhung. Ở lại với điều đã tốt. Niềm vui là kế hoạch khi bạn giữ nó trung thực.',
    shadow: 'Thoải mái cứng đầu — vườn có thể thành hàng rào.',
    gift: 'Khiến căn phòng như nhà.',
  },
  gemini: {
    name: 'Song Tử',
    symbol: 'Sinh đôi',
    kicker: 'Hai giọng, một trời.',
    traits: ['tò mò', 'nhanh', 'dí dỏm'],
    blurb:
      'Song Tử chia cuộc trò chuyện thành tia lửa. Hai cột ánh sáng, tin nhắn giao nhau, không chỉ một câu chuyện.',
    oracle:
      'Rose quạt cặp song sinh. Hãy hỏi câu thứ hai. Phòng khách thích trí óc giữ được hai ngọn đèn.',
    shadow: 'Nói mà không hạ cánh — tia lửa không thành thư.',
    gift: 'Trí tuệ mở cánh cửa.',
  },
  cancer: {
    name: 'Cự Giải',
    symbol: 'Cua',
    kicker: 'Thủy triều và tổ ấm.',
    traits: ['chăm sóc', 'nhạy', 'bảo vệ'],
    blurb: 'Cự Giải mang nhà trên lưng. Vỏ cứng, lòng mềm, nhớ mọi thủy triều đã qua.',
    oracle:
      'Rose đặt cua bên nến. Bảo vệ điều bạn yêu, rồi để thủy triều đưa bạn ra ngoài.',
    shadow: 'Giữ quá chặt đến nghẹt thở căn phòng.',
    gift: 'Sự chăm sóc khiến người khác an toàn.',
  },
  leo: {
    name: 'Sư Tử',
    symbol: 'Sư tử',
    kicker: 'Ánh nắng trên sân khấu.',
    traits: ['rộng lượng', 'rực rỡ', 'tự tin'],
    blurb: 'Sư Tử sưởi cả phòng. Bờm vàng, trái tim lớn, và nhu cầu được nhìn thấy khi cho đi.',
    oracle: 'Rose mở mặt sư tử. Hãy tỏa sáng mà không xin lỗi — rồi nhường sân cho người khác.',
    shadow: 'Vỗ tay trở thành lồng.',
    gift: 'Sự ấm áp bạn có thể chia sẻ.',
  },
  virgo: {
    name: 'Xử Nữ',
    symbol: 'Người trinh nữ',
    kicker: 'Chăm sóc tỉ mỉ.',
    traits: ['tinh tế', 'hữu ích', 'thực tế'],
    blurb:
      'Xử Nữ chỉnh lại khăn trải. Chi tiết nhỏ, bàn tay khéo, và tình yêu hiện qua việc làm cho mọi thứ tốt hơn.',
    oracle:
      'Rose chỉnh Xử Nữ. Sửa một việc nhỏ hôm nay. Sự hoàn hảo là tình yêu khi nó phục vụ sống.',
    shadow: 'Phê phán làm khô hết vui.',
    gift: 'Sự chăm sóc làm sáng phòng.',
  },
  libra: {
    name: 'Thiên Bình',
    symbol: 'Cái cân',
    kicker: 'Cân bằng và duyên.',
    traits: ['hòa hợp', 'công bằng', 'duyên dáng'],
    blurb:
      'Thiên Bình cân hai chén. Vẻ đẹp có xương sống, và món quà khiến xung đột nghe như cuộc trò chuyện.',
    oracle: 'Rose cân Thiên Bình. Cân điều còn thiếu. Hòa bình không phải im lặng.',
    shadow: 'Lịch sự né quyết định.',
    gift: 'Sự công bằng vẫn còn dịu dàng.',
  },
  scorpio: {
    name: 'Thiên Yết',
    symbol: 'Bọ cạp',
    kicker: 'Sâu và thật.',
    traits: ['sâu sắc', 'trung thành', 'mạnh mẽ'],
    blurb: 'Thiên Yết nhìn xuyên nhung. Cường độ, trung thành, và dũng khí nói điều khó.',
    oracle: 'Rose đặt bọ cạp. Đặt tên sự thật êm. Sự biến đổi bắt đầu khi nút thắt được nói.',
    shadow: 'Bí mật làm đói căn phòng.',
    gift: 'Trung thành chịu được đêm.',
  },
  sagittarius: {
    name: 'Nhân Mã',
    symbol: 'Cung thủ',
    kicker: 'Mũi tên về phía chân trời.',
    traits: ['tự do', 'lạc quan', 'thành thật'],
    blurb: 'Nhân Mã nhắm ra ngoài cửa sổ. Hài hước lớn, đường dài, và sự thật nói to.',
    oracle: 'Rose kéo cung. Nhắm một chân trời và bước. Tự do cần một bản đồ trung thực.',
    shadow: 'Lang thang không bao giờ về nhà.',
    gift: 'Hy vọng biết hướng đi.',
  },
  capricorn: {
    name: 'Ma Kết',
    symbol: 'Dê núi',
    kicker: 'Đỉnh núi và kỷ luật.',
    traits: ['kiên trì', 'trách nhiệm', 'tham vọng'],
    blurb: 'Ma Kết leo từng bậc. Xương sống, kiên nhẫn, và niềm tự hào trong công việc được xây.',
    oracle:
      'Rose dựng sừng dê. Xây khung để phòng khách nghỉ. Thành công là chăm sóc khi không thành lồng.',
    shadow: 'Nghĩa vụ nghiền nát vui sống.',
    gift: 'Sự bền bỉ đưa bạn lên đỉnh.',
  },
  aquarius: {
    name: 'Bảo Bình',
    symbol: 'Người mang nước',
    kicker: 'Tương lai đổ vào hiện tại.',
    traits: ['độc đáo', 'nhân văn', 'sáng tạo'],
    blurb:
      'Bảo Bình đổ bình cho mọi người. Ý tưởng lạ, trái tim rộng, và món quà thấy cộng đồng trước cái tôi.',
    oracle: 'Rose nghiêng bình nước. Chia sẻ điều kỳ lạ của bạn. Tương lai cần một cái bàn rộng.',
    shadow: 'Lạnh đến mức quên người bên cạnh.',
    gift: 'Tầm nhìn mời mọi người vào.',
  },
  pisces: {
    name: 'Song Ngư',
    symbol: 'Cá',
    kicker: 'Giấc mơ và thủy triều.',
    traits: ['giàu tưởng tượng', 'đồng cảm', 'mềm mại'],
    blurb: 'Song Ngư bơi giữa hai dòng. Giấc mơ, lòng thương, và nghệ thuật chảy qua kẽ hở.',
    oracle:
      'Rose vẽ hai con cá. Tin vào đường dù nó sóng sánh. Giấc mơ nói nửa sự thật — bước cẩn thận.',
    shadow: 'Sương mù ước không bước tiếp.',
    gift: 'Đồng cảm vẫn tìm được bờ.',
  },
};

const SUIT_VI = {
  major: 'Ẩn chính',
  wands: 'Gậy',
  cups: 'Cốc',
  swords: 'Kiếm',
  pentacles: 'Tiền',
};

const MAJOR_VI = {
  'the-fool': {
    name: 'Kẻ Khờ',
    keyword: 'bắt đầu',
    oracle:
      'Rose lật Kẻ Khờ. Bước khỏi mép với túi nhẹ. Phòng khách thích bước đầu không xin phép.',
    shadow: 'Nhảy mà không nhìn xuống.',
    gift: 'Bắt đầu mà không cần cả bản đồ.',
  },
  'the-magician': {
    name: 'Nhà Ảo Thuật',
    keyword: 'ý chí',
    oracle: 'Rose đặt Nhà Ảo Thuật. Công cụ đã sẵn trên khăn. Nói ước muốn như công việc.',
    shadow: 'Mánh khóe không mục tiêu thật.',
    gift: 'Ý chí gom những gì gần.',
  },
  'the-high-priestess': {
    name: 'Nữ Tư Tế',
    keyword: 'biết',
    oracle:
      'Rose nghiêng Nữ Tư Tế. Lắng nghe sau bức màn. Không phải mọi câu trả lời muốn sân khấu.',
    shadow: 'Bí mật làm đói căn phòng.',
    gift: 'Hiểu biết biết chờ lượt.',
  },
  'the-empress': {
    name: 'Nữ Hoàng',
    keyword: 'lớn lên',
    oracle: 'Rose đặt Nữ Hoàng giữa cánh hoa. Nuôi điều bạn muốn lớn. Vẻ đẹp có xương sống.',
    shadow: 'Sung túc quên rễ.',
    gift: 'Bàn ăn cứ đầy thêm.',
  },
  'the-emperor': {
    name: 'Hoàng Đế',
    keyword: 'trật tự',
    oracle:
      'Rose dựng Hoàng Đế. Xây khung để phòng khách nghỉ. Trật tự là chăm sóc khi không thành lồng.',
    shadow: 'Luật nghiền sống.',
    gift: 'Ghế vững cho người sợ.',
  },
  'the-hierophant': {
    name: 'Giáo Hoàng',
    keyword: 'dạy',
    oracle: 'Rose mở Giáo Hoàng. Học bài cũ rồi hát sạch. Dạy là chìa khóa chung.',
    shadow: 'Giáo điều không cho hỏi.',
    gift: 'Nghi lễ giữ cộng đồng.',
  },
  'the-lovers': {
    name: 'Người Yêu',
    keyword: 'chọn',
    oracle: 'Rose trượt Người Yêu. Chọn mối liên kết khớp miệng và chân.',
    shadow: 'Lựa chọn đẹp không cam kết.',
    gift: 'Sự thẳng hàng thề to.',
  },
  'the-chariot': {
    name: 'Xe Ngựa',
    keyword: 'lái',
    oracle: 'Rose lái Xe Ngựa. Giữ cả hai dây cương. Chiến thắng là lái, không chỉ tốc độ.',
    shadow: 'Sức mạnh quên đường.',
    gift: 'Đà có đích đến.',
  },
  strength: {
    name: 'Sức Mạnh',
    keyword: 'dịu',
    oracle: 'Rose chỉ Sức Mạnh. Tay mềm trên sư tử. Dũng khí không hét.',
    shadow: 'Nụ cười giấu hàm siết.',
    gift: 'Sức mạnh vẫn tử tế.',
  },
  'the-hermit': {
    name: 'Ẩn Sĩ',
    keyword: 'tìm',
    oracle: 'Rose nâng đèn Ẩn Sĩ. Rút vào để nghe mình. Quay lại với một câu rõ.',
    shadow: 'Hang thành mãi mãi.',
    gift: 'Ánh sáng mang về.',
  },
  'wheel-of-fortune': {
    name: 'Bánh Xe Số Phận',
    keyword: 'xoay',
    oracle: 'Rose quay Bánh Xe. Cái lên sẽ xuống — cưỡi vòng mà không bám.',
    shadow: 'Đổ lỗi bánh xe mọi ổ gà.',
    gift: 'May mắn gặp sẵn sàng.',
  },
  justice: {
    name: 'Công Lý',
    keyword: 'cân bằng',
    oracle: 'Rose cân Công Lý. Cân điều còn thiếu. Sự thật với mặt bình tĩnh.',
    shadow: 'Án không thương xót.',
    gift: 'Công bằng vẫn tha thứ được.',
  },
  'the-hanged-man': {
    name: 'Người Treo',
    keyword: 'dừng',
    oracle: 'Rose treo lá bài. Dừng lộn ngược. Đôi mắt mới trước chuyển động mới.',
    shadow: 'Chờ giả làm khôn ngoan.',
    gift: 'Buông tay dạy được bài.',
  },
  death: {
    name: 'Cái Chết',
    keyword: 'kết',
    oracle: 'Rose gọi Cái Chết không chớp mắt. Kết lớp da bó chặt. Dọn chỗ cho mới.',
    shadow: 'Sợ đóng cửa lại.',
    gift: 'Kết thúc thành phân bón.',
  },
  temperance: {
    name: 'Tiết Chế',
    keyword: 'pha',
    oracle: 'Rose rót Tiết Chế. Trộn nóng lạnh đến khi uống được.',
    shadow: 'Pha loãng thành vô vị.',
    gift: 'Hỗn hợp chữa cạnh sắc.',
  },
  'the-devil': {
    name: 'Ác Quỷ',
    keyword: 'trói',
    oracle: 'Rose đối mặt Ác Quỷ. Đặt tên sợi xích. Tự do bắt đầu khi nút thắt được nói.',
    shadow: 'Thú vui chiếm nhà.',
    gift: 'Nhìn rõ sự trói buộc.',
  },
  'the-tower': {
    name: 'Tòa Tháp',
    keyword: 'vỡ',
    oracle: 'Rose đánh Tòa Tháp. Mái giả sụp. Xây lại trên điều còn đứng.',
    shadow: 'Kịch tính vì tia lửa riêng.',
    gift: 'Vết nứt cho ánh sáng vào.',
  },
  'the-star': {
    name: 'Ngôi Sao',
    keyword: 'hy vọng',
    oracle: 'Rose nghiêng Ngôi Sao. Hy vọng không diễn thuyết. Đổ nước dưới đêm trong.',
    shadow: 'Sương ước không bước tiếp.',
    gift: 'Đổi mới vẫn mềm.',
  },
  'the-moon': {
    name: 'Mặt Trăng',
    keyword: 'mơ',
    oracle:
      'Rose rút Mặt Trăng. Tin đường dù nó sóng sánh. Giấc mơ nói nửa sự thật — bước cẩn thận.',
    shadow: 'Sợ đội mặt nạ trực giác.',
    gift: 'Tưởng tượng vẫn tìm bờ.',
  },
  'the-sun': {
    name: 'Mặt Trời',
    keyword: 'vui',
    oracle: 'Rose mở Mặt Trời. Ấm không xin lỗi. Niềm vui như sự thật giản dị.',
    shadow: 'Chói làm mù chỗ mềm.',
    gift: 'Ban ngày bạn có thể chia.',
  },
  judgement: {
    name: 'Phán Xét',
    keyword: 'thức',
    oracle:
      'Rose thổi Phán Xét. Trả lời lời gọi bạn đã nghe. Trỗi dậy không bảng điểm cũ.',
    shadow: 'Tự phán không bao giờ hết.',
    gift: 'Cơ hội hai nói to.',
  },
  'the-world': {
    name: 'Thế Giới',
    keyword: 'trọn',
    oracle: 'Rose khép bằng Thế Giới. Một vòng kết. Nhảy một lần, rồi bắt đầu lại.',
    shadow: 'Bám vòng đã xong.',
    gift: 'Hoàn tất vẫn mời thêm.',
  },
};

const RANK_NAME = {
  1: { wands: 'Át Gậy', cups: 'Át Cốc', swords: 'Át Kiếm', pentacles: 'Át Tiền' },
  2: { wands: 'Hai Gậy', cups: 'Hai Cốc', swords: 'Hai Kiếm', pentacles: 'Hai Tiền' },
  3: { wands: 'Ba Gậy', cups: 'Ba Cốc', swords: 'Ba Kiếm', pentacles: 'Ba Tiền' },
  4: { wands: 'Bốn Gậy', cups: 'Bốn Cốc', swords: 'Bốn Kiếm', pentacles: 'Bốn Tiền' },
  5: { wands: 'Năm Gậy', cups: 'Năm Cốc', swords: 'Năm Kiếm', pentacles: 'Năm Tiền' },
  6: { wands: 'Sáu Gậy', cups: 'Sáu Cốc', swords: 'Sáu Kiếm', pentacles: 'Sáu Tiền' },
  7: { wands: 'Bảy Gậy', cups: 'Bảy Cốc', swords: 'Bảy Kiếm', pentacles: 'Bảy Tiền' },
  8: { wands: 'Tám Gậy', cups: 'Tám Cốc', swords: 'Tám Kiếm', pentacles: 'Tám Tiền' },
  9: { wands: 'Chín Gậy', cups: 'Chín Cốc', swords: 'Chín Kiếm', pentacles: 'Chín Tiền' },
  10: { wands: 'Mười Gậy', cups: 'Mười Cốc', swords: 'Mười Kiếm', pentacles: 'Mười Tiền' },
  11: {
    wands: 'Đồng tử Gậy',
    cups: 'Đồng tử Cốc',
    swords: 'Đồng tử Kiếm',
    pentacles: 'Đồng tử Tiền',
  },
  12: {
    wands: 'Hiệp sĩ Gậy',
    cups: 'Hiệp sĩ Cốc',
    swords: 'Hiệp sĩ Kiếm',
    pentacles: 'Hiệp sĩ Tiền',
  },
  13: {
    wands: 'Nữ hoàng Gậy',
    cups: 'Nữ hoàng Cốc',
    swords: 'Nữ hoàng Kiếm',
    pentacles: 'Nữ hoàng Tiền',
  },
  14: { wands: 'Vua Gậy', cups: 'Vua Cốc', swords: 'Vua Kiếm', pentacles: 'Vua Tiền' },
};

const cards = {};
for (const card of A.DECK) {
  if (card.suit === 'major') {
    const m = MAJOR_VI[card.id];
    cards[card.id] = {
      name: m.name,
      keyword: m.keyword,
      oracle: m.oracle,
      gift: m.gift,
      shadow: m.shadow,
      suitLabel: SUIT_VI.major,
      traits: card.traits,
    };
  } else {
    const name = RANK_NAME[card.number]?.[card.suit] || card.name;
    cards[card.id] = {
      name,
      keyword: card.keyword,
      oracle: `Rose đọc ${name}. ${card.keyword} — món quà: ${card.gift} Cẩn thận: ${card.shadow}`,
      gift: card.gift,
      shadow: card.shadow,
      suitLabel: SUIT_VI[card.suit],
      traits: card.traits,
    };
  }
}

const payload = JSON.stringify({ signs: SIGN_VI, cards }, null, 2);
const out = `/**
 * Vietnamese overlay for Rose parlor signs + tarot.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  root.AstrologyCopyVi = ${payload};
})(typeof globalThis !== 'undefined' ? globalThis : window);
`;

writeFileSync(join(root, 'public/entertainment/js/astrology-copy-vi.js'), out);
console.log('wrote signs', Object.keys(SIGN_VI).length, 'cards', Object.keys(cards).length);
