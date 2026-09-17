/**
 * Vietnamese overlay for Rose parlor signs + tarot.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  root.AstrologyCopyVi = {
  "signs": {
    "aries": {
      "name": "Bạch Dương",
      "symbol": "Cừu đực",
      "kicker": "Tia lửa đầu năm.",
      "traits": [
        "mạnh mẽ",
        "khởi đầu",
        "thẳng"
      ],
      "blurb": "Bạch Dương đá bánh xe. Sừng vàng, nghiêng về phía trước, và dũng khí bắt đầu trước khi bản đồ hoàn tất.",
      "oracle": "Rose lật mặt cừu đực. Bắt đầu trước khi bạn cảm thấy sẵn sàng. Phòng khách thưởng bước đầu sạch hơn bản đồ hoàn hảo.",
      "shadow": "Nóng mà không có cửa — bạn có thể đốt căn phòng bạn định sưởi.",
      "gift": "Dũng khí để bắt đầu."
    },
    "taurus": {
      "name": "Kim Ngưu",
      "symbol": "Bò đực",
      "kicker": "Sang trọng chậm, đất chắc.",
      "traits": [
        "vững",
        "cảm giác",
        "trung thành"
      ],
      "blurb": "Kim Ngưu giữ vườn. Chữ V của sao, khẩu vị kiên nhẫn, và món quà khiến căn phòng như nhà.",
      "oracle": "Rose đặt bò trên nhung. Ở lại với điều đã tốt. Niềm vui là kế hoạch khi bạn giữ nó trung thực.",
      "shadow": "Thoải mái cứng đầu — vườn có thể thành hàng rào.",
      "gift": "Khiến căn phòng như nhà."
    },
    "gemini": {
      "name": "Song Tử",
      "symbol": "Sinh đôi",
      "kicker": "Hai giọng, một trời.",
      "traits": [
        "tò mò",
        "nhanh",
        "dí dỏm"
      ],
      "blurb": "Song Tử chia cuộc trò chuyện thành tia lửa. Hai cột ánh sáng, tin nhắn giao nhau, không chỉ một câu chuyện.",
      "oracle": "Rose quạt cặp song sinh. Hãy hỏi câu thứ hai. Phòng khách thích trí óc giữ được hai ngọn đèn.",
      "shadow": "Nói mà không hạ cánh — tia lửa không thành thư.",
      "gift": "Trí tuệ mở cánh cửa."
    },
    "cancer": {
      "name": "Cự Giải",
      "symbol": "Cua",
      "kicker": "Thủy triều và tổ ấm.",
      "traits": [
        "chăm sóc",
        "nhạy",
        "bảo vệ"
      ],
      "blurb": "Cự Giải mang nhà trên lưng. Vỏ cứng, lòng mềm, nhớ mọi thủy triều đã qua.",
      "oracle": "Rose đặt cua bên nến. Bảo vệ điều bạn yêu, rồi để thủy triều đưa bạn ra ngoài.",
      "shadow": "Giữ quá chặt đến nghẹt thở căn phòng.",
      "gift": "Sự chăm sóc khiến người khác an toàn."
    },
    "leo": {
      "name": "Sư Tử",
      "symbol": "Sư tử",
      "kicker": "Ánh nắng trên sân khấu.",
      "traits": [
        "rộng lượng",
        "rực rỡ",
        "tự tin"
      ],
      "blurb": "Sư Tử sưởi cả phòng. Bờm vàng, trái tim lớn, và nhu cầu được nhìn thấy khi cho đi.",
      "oracle": "Rose mở mặt sư tử. Hãy tỏa sáng mà không xin lỗi — rồi nhường sân cho người khác.",
      "shadow": "Vỗ tay trở thành lồng.",
      "gift": "Sự ấm áp bạn có thể chia sẻ."
    },
    "virgo": {
      "name": "Xử Nữ",
      "symbol": "Người trinh nữ",
      "kicker": "Chăm sóc tỉ mỉ.",
      "traits": [
        "tinh tế",
        "hữu ích",
        "thực tế"
      ],
      "blurb": "Xử Nữ chỉnh lại khăn trải. Chi tiết nhỏ, bàn tay khéo, và tình yêu hiện qua việc làm cho mọi thứ tốt hơn.",
      "oracle": "Rose chỉnh Xử Nữ. Sửa một việc nhỏ hôm nay. Sự hoàn hảo là tình yêu khi nó phục vụ sống.",
      "shadow": "Phê phán làm khô hết vui.",
      "gift": "Sự chăm sóc làm sáng phòng."
    },
    "libra": {
      "name": "Thiên Bình",
      "symbol": "Cái cân",
      "kicker": "Cân bằng và duyên.",
      "traits": [
        "hòa hợp",
        "công bằng",
        "duyên dáng"
      ],
      "blurb": "Thiên Bình cân hai chén. Vẻ đẹp có xương sống, và món quà khiến xung đột nghe như cuộc trò chuyện.",
      "oracle": "Rose cân Thiên Bình. Cân điều còn thiếu. Hòa bình không phải im lặng.",
      "shadow": "Lịch sự né quyết định.",
      "gift": "Sự công bằng vẫn còn dịu dàng."
    },
    "scorpio": {
      "name": "Thiên Yết",
      "symbol": "Bọ cạp",
      "kicker": "Sâu và thật.",
      "traits": [
        "sâu sắc",
        "trung thành",
        "mạnh mẽ"
      ],
      "blurb": "Thiên Yết nhìn xuyên nhung. Cường độ, trung thành, và dũng khí nói điều khó.",
      "oracle": "Rose đặt bọ cạp. Đặt tên sự thật êm. Sự biến đổi bắt đầu khi nút thắt được nói.",
      "shadow": "Bí mật làm đói căn phòng.",
      "gift": "Trung thành chịu được đêm."
    },
    "sagittarius": {
      "name": "Nhân Mã",
      "symbol": "Cung thủ",
      "kicker": "Mũi tên về phía chân trời.",
      "traits": [
        "tự do",
        "lạc quan",
        "thành thật"
      ],
      "blurb": "Nhân Mã nhắm ra ngoài cửa sổ. Hài hước lớn, đường dài, và sự thật nói to.",
      "oracle": "Rose kéo cung. Nhắm một chân trời và bước. Tự do cần một bản đồ trung thực.",
      "shadow": "Lang thang không bao giờ về nhà.",
      "gift": "Hy vọng biết hướng đi."
    },
    "capricorn": {
      "name": "Ma Kết",
      "symbol": "Dê núi",
      "kicker": "Đỉnh núi và kỷ luật.",
      "traits": [
        "kiên trì",
        "trách nhiệm",
        "tham vọng"
      ],
      "blurb": "Ma Kết leo từng bậc. Xương sống, kiên nhẫn, và niềm tự hào trong công việc được xây.",
      "oracle": "Rose dựng sừng dê. Xây khung để phòng khách nghỉ. Thành công là chăm sóc khi không thành lồng.",
      "shadow": "Nghĩa vụ nghiền nát vui sống.",
      "gift": "Sự bền bỉ đưa bạn lên đỉnh."
    },
    "aquarius": {
      "name": "Bảo Bình",
      "symbol": "Người mang nước",
      "kicker": "Tương lai đổ vào hiện tại.",
      "traits": [
        "độc đáo",
        "nhân văn",
        "sáng tạo"
      ],
      "blurb": "Bảo Bình đổ bình cho mọi người. Ý tưởng lạ, trái tim rộng, và món quà thấy cộng đồng trước cái tôi.",
      "oracle": "Rose nghiêng bình nước. Chia sẻ điều kỳ lạ của bạn. Tương lai cần một cái bàn rộng.",
      "shadow": "Lạnh đến mức quên người bên cạnh.",
      "gift": "Tầm nhìn mời mọi người vào."
    },
    "pisces": {
      "name": "Song Ngư",
      "symbol": "Cá",
      "kicker": "Giấc mơ và thủy triều.",
      "traits": [
        "giàu tưởng tượng",
        "đồng cảm",
        "mềm mại"
      ],
      "blurb": "Song Ngư bơi giữa hai dòng. Giấc mơ, lòng thương, và nghệ thuật chảy qua kẽ hở.",
      "oracle": "Rose vẽ hai con cá. Tin vào đường dù nó sóng sánh. Giấc mơ nói nửa sự thật — bước cẩn thận.",
      "shadow": "Sương mù ước không bước tiếp.",
      "gift": "Đồng cảm vẫn tìm được bờ."
    }
  },
  "cards": {
    "the-fool": {
      "name": "Kẻ Khờ",
      "keyword": "bắt đầu",
      "oracle": "Rose lật Kẻ Khờ. Bước khỏi mép với túi nhẹ. Phòng khách thích bước đầu không xin phép.",
      "gift": "Bắt đầu mà không cần cả bản đồ.",
      "shadow": "Nhảy mà không nhìn xuống.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "open",
        "curious",
        "unburdened"
      ]
    },
    "the-magician": {
      "name": "Nhà Ảo Thuật",
      "keyword": "ý chí",
      "oracle": "Rose đặt Nhà Ảo Thuật. Công cụ đã sẵn trên khăn. Nói ước muốn như công việc.",
      "gift": "Ý chí gom những gì gần.",
      "shadow": "Mánh khóe không mục tiêu thật.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "skilled",
        "focused",
        "ready"
      ]
    },
    "the-high-priestess": {
      "name": "Nữ Tư Tế",
      "keyword": "biết",
      "oracle": "Rose nghiêng Nữ Tư Tế. Lắng nghe sau bức màn. Không phải mọi câu trả lời muốn sân khấu.",
      "gift": "Hiểu biết biết chờ lượt.",
      "shadow": "Bí mật làm đói căn phòng.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "quiet",
        "intuitive",
        "veiled"
      ]
    },
    "the-empress": {
      "name": "Nữ Hoàng",
      "keyword": "lớn lên",
      "oracle": "Rose đặt Nữ Hoàng giữa cánh hoa. Nuôi điều bạn muốn lớn. Vẻ đẹp có xương sống.",
      "gift": "Bàn ăn cứ đầy thêm.",
      "shadow": "Sung túc quên rễ.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "lush",
        "creative",
        "generous"
      ]
    },
    "the-emperor": {
      "name": "Hoàng Đế",
      "keyword": "trật tự",
      "oracle": "Rose dựng Hoàng Đế. Xây khung để phòng khách nghỉ. Trật tự là chăm sóc khi không thành lồng.",
      "gift": "Ghế vững cho người sợ.",
      "shadow": "Luật nghiền sống.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "steady",
        "structured",
        "protective"
      ]
    },
    "the-hierophant": {
      "name": "Giáo Hoàng",
      "keyword": "dạy",
      "oracle": "Rose mở Giáo Hoàng. Học bài cũ rồi hát sạch. Dạy là chìa khóa chung.",
      "gift": "Nghi lễ giữ cộng đồng.",
      "shadow": "Giáo điều không cho hỏi.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "traditional",
        "guiding",
        "shared"
      ]
    },
    "the-lovers": {
      "name": "Người Yêu",
      "keyword": "chọn",
      "oracle": "Rose trượt Người Yêu. Chọn mối liên kết khớp miệng và chân.",
      "gift": "Sự thẳng hàng thề to.",
      "shadow": "Lựa chọn đẹp không cam kết.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "aligned",
        "honest",
        "bonded"
      ]
    },
    "the-chariot": {
      "name": "Xe Ngựa",
      "keyword": "lái",
      "oracle": "Rose lái Xe Ngựa. Giữ cả hai dây cương. Chiến thắng là lái, không chỉ tốc độ.",
      "gift": "Đà có đích đến.",
      "shadow": "Sức mạnh quên đường.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "directed",
        "brave",
        "moving"
      ]
    },
    "strength": {
      "name": "Sức Mạnh",
      "keyword": "dịu",
      "oracle": "Rose chỉ Sức Mạnh. Tay mềm trên sư tử. Dũng khí không hét.",
      "gift": "Sức mạnh vẫn tử tế.",
      "shadow": "Nụ cười giấu hàm siết.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "calm",
        "courageous",
        "tender"
      ]
    },
    "the-hermit": {
      "name": "Ẩn Sĩ",
      "keyword": "tìm",
      "oracle": "Rose nâng đèn Ẩn Sĩ. Rút vào để nghe mình. Quay lại với một câu rõ.",
      "gift": "Ánh sáng mang về.",
      "shadow": "Hang thành mãi mãi.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "solitary",
        "wise",
        "lit"
      ]
    },
    "wheel-of-fortune": {
      "name": "Bánh Xe Số Phận",
      "keyword": "xoay",
      "oracle": "Rose quay Bánh Xe. Cái lên sẽ xuống — cưỡi vòng mà không bám.",
      "gift": "May mắn gặp sẵn sàng.",
      "shadow": "Đổ lỗi bánh xe mọi ổ gà.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "changing",
        "timely",
        "cyclic"
      ]
    },
    "justice": {
      "name": "Công Lý",
      "keyword": "cân bằng",
      "oracle": "Rose cân Công Lý. Cân điều còn thiếu. Sự thật với mặt bình tĩnh.",
      "gift": "Công bằng vẫn tha thứ được.",
      "shadow": "Án không thương xót.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "fair",
        "clear",
        "accountable"
      ]
    },
    "the-hanged-man": {
      "name": "Người Treo",
      "keyword": "dừng",
      "oracle": "Rose treo lá bài. Dừng lộn ngược. Đôi mắt mới trước chuyển động mới.",
      "gift": "Buông tay dạy được bài.",
      "shadow": "Chờ giả làm khôn ngoan.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "suspended",
        "seeing",
        "surrendered"
      ]
    },
    "death": {
      "name": "Cái Chết",
      "keyword": "kết",
      "oracle": "Rose gọi Cái Chết không chớp mắt. Kết lớp da bó chặt. Dọn chỗ cho mới.",
      "gift": "Kết thúc thành phân bón.",
      "shadow": "Sợ đóng cửa lại.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "closing",
        "clearing",
        "reborn"
      ]
    },
    "temperance": {
      "name": "Tiết Chế",
      "keyword": "pha",
      "oracle": "Rose rót Tiết Chế. Trộn nóng lạnh đến khi uống được.",
      "gift": "Hỗn hợp chữa cạnh sắc.",
      "shadow": "Pha loãng thành vô vị.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "measured",
        "healing",
        "patient"
      ]
    },
    "the-devil": {
      "name": "Ác Quỷ",
      "keyword": "trói",
      "oracle": "Rose đối mặt Ác Quỷ. Đặt tên sợi xích. Tự do bắt đầu khi nút thắt được nói.",
      "gift": "Nhìn rõ sự trói buộc.",
      "shadow": "Thú vui chiếm nhà.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "tempted",
        "honest",
        "untangling"
      ]
    },
    "the-tower": {
      "name": "Tòa Tháp",
      "keyword": "vỡ",
      "oracle": "Rose đánh Tòa Tháp. Mái giả sụp. Xây lại trên điều còn đứng.",
      "gift": "Vết nứt cho ánh sáng vào.",
      "shadow": "Kịch tính vì tia lửa riêng.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "sudden",
        "true",
        "rebuilding"
      ]
    },
    "the-star": {
      "name": "Ngôi Sao",
      "keyword": "hy vọng",
      "oracle": "Rose nghiêng Ngôi Sao. Hy vọng không diễn thuyết. Đổ nước dưới đêm trong.",
      "gift": "Đổi mới vẫn mềm.",
      "shadow": "Sương ước không bước tiếp.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "quiet",
        "renewing",
        "open"
      ]
    },
    "the-moon": {
      "name": "Mặt Trăng",
      "keyword": "mơ",
      "oracle": "Rose rút Mặt Trăng. Tin đường dù nó sóng sánh. Giấc mơ nói nửa sự thật — bước cẩn thận.",
      "gift": "Tưởng tượng vẫn tìm bờ.",
      "shadow": "Sợ đội mặt nạ trực giác.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "uncertain",
        "imaginative",
        "deep"
      ]
    },
    "the-sun": {
      "name": "Mặt Trời",
      "keyword": "vui",
      "oracle": "Rose mở Mặt Trời. Ấm không xin lỗi. Niềm vui như sự thật giản dị.",
      "gift": "Ban ngày bạn có thể chia.",
      "shadow": "Chói làm mù chỗ mềm.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "bright",
        "simple",
        "alive"
      ]
    },
    "judgement": {
      "name": "Phán Xét",
      "keyword": "thức",
      "oracle": "Rose thổi Phán Xét. Trả lời lời gọi bạn đã nghe. Trỗi dậy không bảng điểm cũ.",
      "gift": "Cơ hội hai nói to.",
      "shadow": "Tự phán không bao giờ hết.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "called",
        "forgiving",
        "rising"
      ]
    },
    "the-world": {
      "name": "Thế Giới",
      "keyword": "trọn",
      "oracle": "Rose khép bằng Thế Giới. Một vòng kết. Nhảy một lần, rồi bắt đầu lại.",
      "gift": "Hoàn tất vẫn mời thêm.",
      "shadow": "Bám vòng đã xong.",
      "suitLabel": "Ẩn chính",
      "traits": [
        "whole",
        "dancing",
        "arrived"
      ]
    },
    "ace-of-wands": {
      "name": "Át Gậy",
      "keyword": "spark",
      "oracle": "Rose đọc Át Gậy. spark — món quà: Permission to begin. Cẩn thận: A spark that never becomes a flame.",
      "gift": "Permission to begin.",
      "shadow": "A spark that never becomes a flame.",
      "suitLabel": "Gậy",
      "traits": [
        "starting",
        "eager",
        "alive"
      ]
    },
    "two-of-wands": {
      "name": "Hai Gậy",
      "keyword": "plan",
      "oracle": "Rose đọc Hai Gậy. plan — món quà: A plan that faces the horizon. Cẩn thận: Planning that never leaves the rail.",
      "gift": "A plan that faces the horizon.",
      "shadow": "Planning that never leaves the rail.",
      "suitLabel": "Gậy",
      "traits": [
        "vision",
        "choice",
        "poised"
      ]
    },
    "three-of-wands": {
      "name": "Ba Gậy",
      "keyword": "expand",
      "oracle": "Rose đọc Ba Gậy. expand — món quà: Expansion with patience. Cẩn thận: Waiting without tending the docks.",
      "gift": "Expansion with patience.",
      "shadow": "Waiting without tending the docks.",
      "suitLabel": "Gậy",
      "traits": [
        "horizon",
        "trade",
        "growth"
      ]
    },
    "four-of-wands": {
      "name": "Bốn Gậy",
      "keyword": "home",
      "oracle": "Rose đọc Bốn Gậy. home — món quà: A welcome that holds. Cẩn thận: Party without a foundation.",
      "gift": "A welcome that holds.",
      "shadow": "Party without a foundation.",
      "suitLabel": "Gậy",
      "traits": [
        "festive",
        "stable",
        "shared"
      ]
    },
    "five-of-wands": {
      "name": "Năm Gậy",
      "keyword": "clash",
      "oracle": "Rose đọc Năm Gậy. clash — món quà: Honest contest. Cẩn thận: Noise that never learns.",
      "gift": "Honest contest.",
      "shadow": "Noise that never learns.",
      "suitLabel": "Gậy",
      "traits": [
        "contest",
        "messy",
        "alive"
      ]
    },
    "six-of-wands": {
      "name": "Sáu Gậy",
      "keyword": "victory",
      "oracle": "Rose đọc Sáu Gậy. victory — món quà: Recognition earned. Cẩn thận: Applause that becomes a cage.",
      "gift": "Recognition earned.",
      "shadow": "Applause that becomes a cage.",
      "suitLabel": "Gậy",
      "traits": [
        "proud",
        "seen",
        "forward"
      ]
    },
    "seven-of-wands": {
      "name": "Bảy Gậy",
      "keyword": "stand",
      "oracle": "Rose đọc Bảy Gậy. stand — món quà: Courage under pressure. Cẩn thận: Defending everything, resting nowhere.",
      "gift": "Courage under pressure.",
      "shadow": "Defending everything, resting nowhere.",
      "suitLabel": "Gậy",
      "traits": [
        "defiant",
        "firm",
        "tested"
      ]
    },
    "eight-of-wands": {
      "name": "Tám Gậy",
      "keyword": "swift",
      "oracle": "Rose đọc Tám Gậy. swift — món quà: Speed with aim. Cẩn thận: Rush that scatters the arrows.",
      "gift": "Speed with aim.",
      "shadow": "Rush that scatters the arrows.",
      "suitLabel": "Gậy",
      "traits": [
        "fast",
        "clear",
        "urgent"
      ]
    },
    "nine-of-wands": {
      "name": "Chín Gậy",
      "keyword": "guard",
      "oracle": "Rose đọc Chín Gậy. guard — món quà: Resilience with boundaries. Cẩn thận: Suspicion that never softens.",
      "gift": "Resilience with boundaries.",
      "shadow": "Suspicion that never softens.",
      "suitLabel": "Gậy",
      "traits": [
        "wary",
        "strong",
        "tired"
      ]
    },
    "ten-of-wands": {
      "name": "Mười Gậy",
      "keyword": "burden",
      "oracle": "Rose đọc Mười Gậy. burden — món quà: Permission to lighten the load. Cẩn thận: Martyrdom wearing a hero cape.",
      "gift": "Permission to lighten the load.",
      "shadow": "Martyrdom wearing a hero cape.",
      "suitLabel": "Gậy",
      "traits": [
        "loaded",
        "dutiful",
        "strained"
      ]
    },
    "page-of-wands": {
      "name": "Đồng tử Gậy",
      "keyword": "messenger",
      "oracle": "Rose đọc Đồng tử Gậy. messenger — món quà: Fresh courage to explore. Cẩn thận: Enthusiasm without follow-through.",
      "gift": "Fresh courage to explore.",
      "shadow": "Enthusiasm without follow-through.",
      "suitLabel": "Gậy",
      "traits": [
        "curious",
        "bold",
        "young"
      ]
    },
    "knight-of-wands": {
      "name": "Hiệp sĩ Gậy",
      "keyword": "charge",
      "oracle": "Rose đọc Hiệp sĩ Gậy. charge — món quà: Passionate motion. Cẩn thận: Impulse that burns the bridge.",
      "gift": "Passionate motion.",
      "shadow": "Impulse that burns the bridge.",
      "suitLabel": "Gậy",
      "traits": [
        "fiery",
        "swift",
        "restless"
      ]
    },
    "queen-of-wands": {
      "name": "Nữ hoàng Gậy",
      "keyword": "warmth",
      "oracle": "Rose đọc Nữ hoàng Gậy. warmth — món quà: Confident hospitality. Cẩn thận: Charisma that scorches the shy.",
      "gift": "Confident hospitality.",
      "shadow": "Charisma that scorches the shy.",
      "suitLabel": "Gậy",
      "traits": [
        "magnetic",
        "steady",
        "creative"
      ]
    },
    "king-of-wands": {
      "name": "Vua Gậy",
      "keyword": "lead",
      "oracle": "Rose đọc Vua Gậy. lead — món quà: Leadership with heart. Cẩn thận: Ego that mistimes the campaign.",
      "gift": "Leadership with heart.",
      "shadow": "Ego that mistimes the campaign.",
      "suitLabel": "Gậy",
      "traits": [
        "visionary",
        "decisive",
        "bold"
      ]
    },
    "ace-of-cups": {
      "name": "Át Cốc",
      "keyword": "open",
      "oracle": "Rose đọc Át Cốc. open — món quà: Emotional beginning. Cẩn thận: Overflow with no vessel.",
      "gift": "Emotional beginning.",
      "shadow": "Overflow with no vessel.",
      "suitLabel": "Cốc",
      "traits": [
        "tender",
        "new",
        "receptive"
      ]
    },
    "two-of-cups": {
      "name": "Hai Cốc",
      "keyword": "bond",
      "oracle": "Rose đọc Hai Cốc. bond — món quà: Mutual recognition. Cẩn thận: Romance that skips the truth.",
      "gift": "Mutual recognition.",
      "shadow": "Romance that skips the truth.",
      "suitLabel": "Cốc",
      "traits": [
        "partnered",
        "kind",
        "mirrored"
      ]
    },
    "three-of-cups": {
      "name": "Ba Cốc",
      "keyword": "toast",
      "oracle": "Rose đọc Ba Cốc. toast — món quà: Shared joy. Cẩn thận: Toast that forgets the morning.",
      "gift": "Shared joy.",
      "shadow": "Toast that forgets the morning.",
      "suitLabel": "Cốc",
      "traits": [
        "social",
        "glad",
        "supportive"
      ]
    },
    "four-of-cups": {
      "name": "Bốn Cốc",
      "keyword": "apathy",
      "oracle": "Rose đọc Bốn Cốc. apathy — món quà: Honest pause. Cẩn thận: Numbness mistaken for wisdom.",
      "gift": "Honest pause.",
      "shadow": "Numbness mistaken for wisdom.",
      "suitLabel": "Cốc",
      "traits": [
        "withdrawn",
        "weary",
        "choosing"
      ]
    },
    "five-of-cups": {
      "name": "Năm Cốc",
      "keyword": "grief",
      "oracle": "Rose đọc Năm Cốc. grief — món quà: Grief that can look up. Cẩn thận: Loss that refuses the remaining cups.",
      "gift": "Grief that can look up.",
      "shadow": "Loss that refuses the remaining cups.",
      "suitLabel": "Cốc",
      "traits": [
        "mourning",
        "regret",
        "turning"
      ]
    },
    "six-of-cups": {
      "name": "Sáu Cốc",
      "keyword": "memory",
      "oracle": "Rose đọc Sáu Cốc. memory — món quà: Innocent exchange. Cẩn thận: Nostalgia that traps the present.",
      "gift": "Innocent exchange.",
      "shadow": "Nostalgia that traps the present.",
      "suitLabel": "Cốc",
      "traits": [
        "nostalgic",
        "gentle",
        "giving"
      ]
    },
    "seven-of-cups": {
      "name": "Bảy Cốc",
      "keyword": "choice",
      "oracle": "Rose đọc Bảy Cốc. choice — món quà: Imagination with a decision. Cẩn thận: Fantasy that never lands.",
      "gift": "Imagination with a decision.",
      "shadow": "Fantasy that never lands.",
      "suitLabel": "Cốc",
      "traits": [
        "dreamy",
        "tempted",
        "selecting"
      ]
    },
    "eight-of-cups": {
      "name": "Tám Cốc",
      "keyword": "leave",
      "oracle": "Rose đọc Tám Cốc. leave — món quà: Courage to walk away. Cẩn thận: Leaving only to avoid feeling.",
      "gift": "Courage to walk away.",
      "shadow": "Leaving only to avoid feeling.",
      "suitLabel": "Cốc",
      "traits": [
        "departing",
        "seeking",
        "honest"
      ]
    },
    "nine-of-cups": {
      "name": "Chín Cốc",
      "keyword": "wish",
      "oracle": "Rose đọc Chín Cốc. wish — món quà: Contentment earned. Cẩn thận: Smugness that closes the door.",
      "gift": "Contentment earned.",
      "shadow": "Smugness that closes the door.",
      "suitLabel": "Cốc",
      "traits": [
        "satisfied",
        "proud",
        "warm"
      ]
    },
    "ten-of-cups": {
      "name": "Mười Cốc",
      "keyword": "home",
      "oracle": "Rose đọc Mười Cốc. home — món quà: Emotional fullness. Cẩn thận: A picture-perfect lie.",
      "gift": "Emotional fullness.",
      "shadow": "A picture-perfect lie.",
      "suitLabel": "Cốc",
      "traits": [
        "family",
        "peace",
        "shared"
      ]
    },
    "page-of-cups": {
      "name": "Đồng tử Cốc",
      "keyword": "message",
      "oracle": "Rose đọc Đồng tử Cốc. message — món quà: Emotional news. Cẩn thận: Sensitivity that floods the room.",
      "gift": "Emotional news.",
      "shadow": "Sensitivity that floods the room.",
      "suitLabel": "Cốc",
      "traits": [
        "dreamy",
        "kind",
        "open"
      ]
    },
    "knight-of-cups": {
      "name": "Hiệp sĩ Cốc",
      "keyword": "offer",
      "oracle": "Rose đọc Hiệp sĩ Cốc. offer — món quà: Romantic courage. Cẩn thận: Charm without follow-through.",
      "gift": "Romantic courage.",
      "shadow": "Charm without follow-through.",
      "suitLabel": "Cốc",
      "traits": [
        "ideal",
        "poetic",
        "seeking"
      ]
    },
    "queen-of-cups": {
      "name": "Nữ hoàng Cốc",
      "keyword": "hold",
      "oracle": "Rose đọc Nữ hoàng Cốc. hold — món quà: Deep listening. Cẩn thận: Absorbing everyone else's weather.",
      "gift": "Deep listening.",
      "shadow": "Absorbing everyone else's weather.",
      "suitLabel": "Cốc",
      "traits": [
        "intuitive",
        "calm",
        "caring"
      ]
    },
    "king-of-cups": {
      "name": "Vua Cốc",
      "keyword": "compose",
      "oracle": "Rose đọc Vua Cốc. compose — món quà: Emotional mastery. Cẩn thận: Control that freezes warmth.",
      "gift": "Emotional mastery.",
      "shadow": "Control that freezes warmth.",
      "suitLabel": "Cốc",
      "traits": [
        "balanced",
        "wise",
        "steady"
      ]
    },
    "ace-of-swords": {
      "name": "Át Kiếm",
      "keyword": "clarity",
      "oracle": "Rose đọc Át Kiếm. clarity — món quà: Mental breakthrough. Cẩn thận: Truth used as a weapon.",
      "gift": "Mental breakthrough.",
      "shadow": "Truth used as a weapon.",
      "suitLabel": "Kiếm",
      "traits": [
        "clear",
        "decisive",
        "piercing"
      ]
    },
    "two-of-swords": {
      "name": "Hai Kiếm",
      "keyword": "stalemate",
      "oracle": "Rose đọc Hai Kiếm. stalemate — món quà: Pause before the cut. Cẩn thận: Avoidance dressed as peace.",
      "gift": "Pause before the cut.",
      "shadow": "Avoidance dressed as peace.",
      "suitLabel": "Kiếm",
      "traits": [
        "blocked",
        "weighing",
        "quiet"
      ]
    },
    "three-of-swords": {
      "name": "Ba Kiếm",
      "keyword": "hurt",
      "oracle": "Rose đọc Ba Kiếm. hurt — món quà: Honest sorrow. Cẩn thận: Replaying the wound forever.",
      "gift": "Honest sorrow.",
      "shadow": "Replaying the wound forever.",
      "suitLabel": "Kiếm",
      "traits": [
        "pain",
        "truth",
        "release"
      ]
    },
    "four-of-swords": {
      "name": "Bốn Kiếm",
      "keyword": "rest",
      "oracle": "Rose đọc Bốn Kiếm. rest — món quà: Sacred pause. Cẩn thận: Retreat that becomes disappearance.",
      "gift": "Sacred pause.",
      "shadow": "Retreat that becomes disappearance.",
      "suitLabel": "Kiếm",
      "traits": [
        "resting",
        "healing",
        "still"
      ]
    },
    "five-of-swords": {
      "name": "Năm Kiếm",
      "keyword": "hollow",
      "oracle": "Rose đọc Năm Kiếm. hollow — món quà: Seeing the cost. Cẩn thận: Victory that isolates.",
      "gift": "Seeing the cost.",
      "shadow": "Victory that isolates.",
      "suitLabel": "Kiếm",
      "traits": [
        "conflict",
        "ego",
        "aftermath"
      ]
    },
    "six-of-swords": {
      "name": "Sáu Kiếm",
      "keyword": "passage",
      "oracle": "Rose đọc Sáu Kiếm. passage — món quà: Transition toward calmer mind. Cẩn thận: Fleeing without learning.",
      "gift": "Transition toward calmer mind.",
      "shadow": "Fleeing without learning.",
      "suitLabel": "Kiếm",
      "traits": [
        "moving",
        "quiet",
        "guided"
      ]
    },
    "seven-of-swords": {
      "name": "Bảy Kiếm",
      "keyword": "strategy",
      "oracle": "Rose đọc Bảy Kiếm. strategy — món quà: Clever exit. Cẩn thận: Deceit that trips itself.",
      "gift": "Clever exit.",
      "shadow": "Deceit that trips itself.",
      "suitLabel": "Kiếm",
      "traits": [
        "crafty",
        "alone",
        "calculating"
      ]
    },
    "eight-of-swords": {
      "name": "Tám Kiếm",
      "keyword": "bind",
      "oracle": "Rose đọc Tám Kiếm. bind — món quà: Seeing the exit. Cẩn thận: Helplessness as a habit.",
      "gift": "Seeing the exit.",
      "shadow": "Helplessness as a habit.",
      "suitLabel": "Kiếm",
      "traits": [
        "trapped",
        "anxious",
        "awakening"
      ]
    },
    "nine-of-swords": {
      "name": "Chín Kiếm",
      "keyword": "worry",
      "oracle": "Rose đọc Chín Kiếm. worry — món quà: Worry brought into light. Cẩn thận: Spirals that never leave the bed.",
      "gift": "Worry brought into light.",
      "shadow": "Spirals that never leave the bed.",
      "suitLabel": "Kiếm",
      "traits": [
        "anxious",
        "sleepless",
        "honest"
      ]
    },
    "ten-of-swords": {
      "name": "Mười Kiếm",
      "keyword": "ending",
      "oracle": "Rose đọc Mười Kiếm. ending — món quà: Clean ending. Cẩn thận: Drama that prolongs the knives.",
      "gift": "Clean ending.",
      "shadow": "Drama that prolongs the knives.",
      "suitLabel": "Kiếm",
      "traits": [
        "final",
        "raw",
        "sunrise"
      ]
    },
    "page-of-swords": {
      "name": "Đồng tử Kiếm",
      "keyword": "curious",
      "oracle": "Rose đọc Đồng tử Kiếm. curious — món quà: Fresh inquiry. Cẩn thận: Gossip wearing a reporter hat.",
      "gift": "Fresh inquiry.",
      "shadow": "Gossip wearing a reporter hat.",
      "suitLabel": "Kiếm",
      "traits": [
        "alert",
        "learning",
        "restless"
      ]
    },
    "knight-of-swords": {
      "name": "Hiệp sĩ Kiếm",
      "keyword": "charge",
      "oracle": "Rose đọc Hiệp sĩ Kiếm. charge — món quà: Brave clarity. Cẩn thận: Argument that tramples care.",
      "gift": "Brave clarity.",
      "shadow": "Argument that tramples care.",
      "suitLabel": "Kiếm",
      "traits": [
        "direct",
        "fast",
        "blunt"
      ]
    },
    "queen-of-swords": {
      "name": "Nữ hoàng Kiếm",
      "keyword": "discern",
      "oracle": "Rose đọc Nữ hoàng Kiếm. discern — món quà: Clear boundaries. Cẩn thận: Coldness mistaken for wisdom.",
      "gift": "Clear boundaries.",
      "shadow": "Coldness mistaken for wisdom.",
      "suitLabel": "Kiếm",
      "traits": [
        "keen",
        "independent",
        "honest"
      ]
    },
    "king-of-swords": {
      "name": "Vua Kiếm",
      "keyword": "judge",
      "oracle": "Rose đọc Vua Kiếm. judge — món quà: Ethical clarity. Cẩn thận: Law without heart.",
      "gift": "Ethical clarity.",
      "shadow": "Law without heart.",
      "suitLabel": "Kiếm",
      "traits": [
        "authoritative",
        "logical",
        "just"
      ]
    },
    "ace-of-pentacles": {
      "name": "Át Tiền",
      "keyword": "seed",
      "oracle": "Rose đọc Át Tiền. seed — món quà: Tangible beginning. Cẩn thận: Opportunity left in the dirt.",
      "gift": "Tangible beginning.",
      "shadow": "Opportunity left in the dirt.",
      "suitLabel": "Tiền",
      "traits": [
        "prosperous",
        "grounded",
        "new"
      ]
    },
    "two-of-pentacles": {
      "name": "Hai Tiền",
      "keyword": "juggle",
      "oracle": "Rose đọc Hai Tiền. juggle — món quà: Flexible balance. Cẩn thận: Busywork that never chooses.",
      "gift": "Flexible balance.",
      "shadow": "Busywork that never chooses.",
      "suitLabel": "Tiền",
      "traits": [
        "adapting",
        "busy",
        "playful"
      ]
    },
    "three-of-pentacles": {
      "name": "Ba Tiền",
      "keyword": "craft",
      "oracle": "Rose đọc Ba Tiền. craft — món quà: Skilled collaboration. Cẩn thận: Ego that refuses apprentices.",
      "gift": "Skilled collaboration.",
      "shadow": "Ego that refuses apprentices.",
      "suitLabel": "Tiền",
      "traits": [
        "team",
        "mastery",
        "work"
      ]
    },
    "four-of-pentacles": {
      "name": "Bốn Tiền",
      "keyword": "hold",
      "oracle": "Rose đọc Bốn Tiền. hold — món quà: Security awareness. Cẩn thận: Clutching that blocks flow.",
      "gift": "Security awareness.",
      "shadow": "Clutching that blocks flow.",
      "suitLabel": "Tiền",
      "traits": [
        "guarded",
        "stable",
        "tense"
      ]
    },
    "five-of-pentacles": {
      "name": "Năm Tiền",
      "keyword": "lack",
      "oracle": "Rose đọc Năm Tiền. lack — món quà: Asking for help. Cẩn thận: Pride that stays in the snow.",
      "gift": "Asking for help.",
      "shadow": "Pride that stays in the snow.",
      "suitLabel": "Tiền",
      "traits": [
        "hardship",
        "exile",
        "seeking"
      ]
    },
    "six-of-pentacles": {
      "name": "Sáu Tiền",
      "keyword": "share",
      "oracle": "Rose đọc Sáu Tiền. share — món quà: Fair exchange. Cẩn thận: Strings attached to the gift.",
      "gift": "Fair exchange.",
      "shadow": "Strings attached to the gift.",
      "suitLabel": "Tiền",
      "traits": [
        "generous",
        "balanced",
        "kind"
      ]
    },
    "seven-of-pentacles": {
      "name": "Bảy Tiền",
      "keyword": "wait",
      "oracle": "Rose đọc Bảy Tiền. wait — món quà: Patient investment. Cẩn thận: Impatience that ruins the crop.",
      "gift": "Patient investment.",
      "shadow": "Impatience that ruins the crop.",
      "suitLabel": "Tiền",
      "traits": [
        "reviewing",
        "patient",
        "earthy"
      ]
    },
    "eight-of-pentacles": {
      "name": "Tám Tiền",
      "keyword": "practice",
      "oracle": "Rose đọc Tám Tiền. practice — món quà: Dedicated work. Cẩn thận: Drudgery without joy.",
      "gift": "Dedicated work.",
      "shadow": "Drudgery without joy.",
      "suitLabel": "Tiền",
      "traits": [
        "diligent",
        "focused",
        "learning"
      ]
    },
    "nine-of-pentacles": {
      "name": "Chín Tiền",
      "keyword": "ripe",
      "oracle": "Rose đọc Chín Tiền. ripe — món quà: Independent abundance. Cẩn thận: Isolation mistaken for luxury.",
      "gift": "Independent abundance.",
      "shadow": "Isolation mistaken for luxury.",
      "suitLabel": "Tiền",
      "traits": [
        "refined",
        "self-sufficient",
        "calm"
      ]
    },
    "ten-of-pentacles": {
      "name": "Mười Tiền",
      "keyword": "legacy",
      "oracle": "Rose đọc Mười Tiền. legacy — món quà: Lasting security. Cẩn thận: Status without belonging.",
      "gift": "Lasting security.",
      "shadow": "Status without belonging.",
      "suitLabel": "Tiền",
      "traits": [
        "family",
        "wealth",
        "rooted"
      ]
    },
    "page-of-pentacles": {
      "name": "Đồng tử Tiền",
      "keyword": "study",
      "oracle": "Rose đọc Đồng tử Tiền. study — món quà: Practical curiosity. Cẩn thận: Planning that never practices.",
      "gift": "Practical curiosity.",
      "shadow": "Planning that never practices.",
      "suitLabel": "Tiền",
      "traits": [
        "earnest",
        "curious",
        "grounded"
      ]
    },
    "knight-of-pentacles": {
      "name": "Hiệp sĩ Tiền",
      "keyword": "steady",
      "oracle": "Rose đọc Hiệp sĩ Tiền. steady — món quà: Steady progress. Cẩn thận: Stubborn pace that misses the season.",
      "gift": "Steady progress.",
      "shadow": "Stubborn pace that misses the season.",
      "suitLabel": "Tiền",
      "traits": [
        "methodical",
        "loyal",
        "slow"
      ]
    },
    "queen-of-pentacles": {
      "name": "Nữ hoàng Tiền",
      "keyword": "nourish",
      "oracle": "Rose đọc Nữ hoàng Tiền. nourish — món quà: Practical warmth. Cẩn thận: Overgiving until empty.",
      "gift": "Practical warmth.",
      "shadow": "Overgiving until empty.",
      "suitLabel": "Tiền",
      "traits": [
        "nurturing",
        "resourceful",
        "present"
      ]
    },
    "king-of-pentacles": {
      "name": "Vua Tiền",
      "keyword": "provide",
      "oracle": "Rose đọc Vua Tiền. provide — món quà: Reliable abundance. Cẩn thận: Control dressed as care.",
      "gift": "Reliable abundance.",
      "shadow": "Control dressed as care.",
      "suitLabel": "Tiền",
      "traits": [
        "prosperous",
        "steady",
        "generous"
      ]
    }
  }
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
