#!/usr/bin/env node
/**
 * Write full bilingual Egypt atlas content + story reel JSON.
 *   node scripts/tools/write-egypt-content.mjs
 * Development work by David Lane
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public/egypt/data');

const b = (en, ar) => ({ en, ar });
const tags = (en, ar) => ({ en, ar });

const UI_EN_KEYS = [
  'dir', 'langLabel', 'switchTo', 'heroKicker', 'heroTitle', 'heroLine',
  'playReel', 'pauseReel', 'resumeReel', 'stopReel', 'narration', 'narrationScope',
  'hearWelcome', 'askGuide', 'stop', 'listen', 'exploreMap', 'timelineHeading',
  'timelineLead', 'timelineSelectHint', 'mapHeading', 'mapLead', 'mapAll',
  'mapHistory', 'mapFood', 'mapMusic', 'mapHookah', 'mapLiving', 'mapReset',
  'mapLoading', 'foodHeading', 'foodLead', 'musicHeading', 'musicLead',
  'hookahHeading', 'hookahLead', 'livingHeading', 'livingLead', 'phraseHeading',
  'phraseLead', 'flipHint', 'playMusic', 'stopMusic', 'back', 'loading',
  'readMore', 'close', 'unesco', 'context', 'evidence', 'startTour', 'meetGuide'
];

function assertUiKeys(ui) {
  const en = Object.keys(ui.en).sort();
  const ar = Object.keys(ui.ar).sort();
  const expected = [...UI_EN_KEYS].sort();
  if (JSON.stringify(en) !== JSON.stringify(expected)) {
    throw new Error(`ui.en keys mismatch:\n${en.join(',')}\nvs\n${expected.join(',')}`);
  }
  if (JSON.stringify(ar) !== JSON.stringify(en)) {
    throw new Error('ui.ar keys must match ui.en');
  }
}

const content = {
  id: 'egypt-atlas',
  brand: {
    name: b('Egypt — Nile and Eternal Stone', 'مصر — النيل والحجر الخالد'),
    tagline: b(
      'From Predynastic villages to Fatimid Cairo — history, table, and song along the Nile.',
      'من قرى ما قبل الأسرات إلى القاهرة الفاطمية — تاريخ ومائدة وغناء على ضفاف النيل.'
    )
  },
  guide: {
    name: b('Omar', 'عمر'),
    title: b('Egypt history guide', 'دليل تاريخ مصر'),
    portrait: '/egypt/assets/omar-guide-portrait-256.png',
    greeting: b(
      'Ahlan wa sahlan. I am Omar — walk with me from Giza to Luxor and Islamic Cairo.',
      'أهلاً وسهلاً. أنا عمر — امشِ معي من الجيزة إلى الأقصر والقاهرة الإسلامية.'
    )
  },
  ui: {
    en: {
      dir: 'ltr',
      langLabel: 'English',
      switchTo: 'عربي',
      heroKicker: 'Nile and Eternal Stone',
      heroTitle: 'Egypt',
      heroLine:
        'A river civilization of pyramids, temples, and living cities — koshari steam, Umm Kulthum song, and café talk from Cairo to Aswan.',
      playReel: 'Play HyperFrame tour',
      pauseReel: 'Pause tour',
      resumeReel: 'Resume tour',
      stopReel: 'Stop tour',
      narration: 'Narration',
      narrationScope: 'Entire page — atlas, tour, and cards',
      hearWelcome: 'Hear welcome',
      askGuide: 'Ask Omar',
      stop: 'Stop',
      listen: 'Listen',
      exploreMap: 'Explore the atlas',
      timelineHeading: 'Eras of Egypt',
      timelineLead:
        'From Predynastic beginnings to the contemporary republic. Select an era to hear it and find it on the map.',
      timelineSelectHint: 'Select an era on the timeline',
      mapHeading: 'Atlas of Egypt',
      mapLead: 'Nile bends, desert edge, and Red Sea coast. Select a pin or a name to hear its story.',
      mapAll: 'All',
      mapHistory: 'History',
      mapFood: 'Food',
      mapMusic: 'Music',
      mapHookah: 'Café',
      mapLiving: 'Living',
      mapReset: 'Show all pins',
      mapLoading: 'Loading the atlas…',
      foodHeading: 'The Egyptian table',
      foodLead: 'Koshari, ful, taameya, and konafa — flip a dish for its origin and meaning.',
      musicHeading: 'Sound of Egypt',
      musicLead: 'Umm Kulthum, tarab, Saʿidi folk, and Cairo nights. Flip a card for the history.',
      hookahHeading: 'Café — tea, coffee, and slow talk',
      hookahLead: 'Ahwa tables, shisha coals, and evening conversation — Cairo and Alexandria as social furniture.',
      livingHeading: 'Living cultures',
      livingLead: 'Nile memory, calligraphy, souqs, feluccas, Coptic communities, and Sinai hospitality.',
      phraseHeading: 'Speak Egyptian',
      phraseLead: 'Everyday Egyptian Arabic greetings heard across Egypt. Press any phrase to hear it.',
      flipHint: 'Flip for the history',
      playMusic: 'Play music',
      stopMusic: 'Stop music',
      back: 'Back',
      loading: 'Loading the atlas…',
      readMore: 'Read the full story',
      close: 'Close',
      unesco: 'UNESCO World Heritage',
      context: 'Context',
      evidence: 'On the ground',
      startTour: 'HyperFrame tour',
      meetGuide: 'Meet Omar'
    },
    ar: {
      dir: 'rtl',
      langLabel: 'العربية',
      switchTo: 'English',
      heroKicker: 'النيل والحجر الخالد',
      heroTitle: 'مصر',
      heroLine:
        'حضارة نهرية من الأهرام والمعابد والمدن الحيّة — بخار الكشري وأغاني أم كلثوم وحديث المقاهي من القاهرة إلى أسوان.',
      playReel: 'شغّل الجولة',
      pauseReel: 'إيقاف مؤقت',
      resumeReel: 'متابعة الجولة',
      stopReel: 'إنهاء الجولة',
      narration: 'السرد الصوتي',
      narrationScope: 'الصفحة كاملة — الأطلس والجولة والبطاقات',
      hearWelcome: 'استمع للترحيب',
      askGuide: 'اسأل عمر',
      stop: 'إيقاف',
      listen: 'استمع',
      exploreMap: 'استكشف الأطلس',
      timelineHeading: 'عصور مصر',
      timelineLead: 'من بدايات ما قبل الأسرات إلى الجمهورية المعاصرة. اختر حقبة لتسمعها وتجدها على الخريطة.',
      timelineSelectHint: 'اختر حقبة من الخط الزمني',
      mapHeading: 'أطلس مصر',
      mapLead: 'انحناءات النيل وحافة الصحراء وساحل البحر الأحمر. اختر علامة أو اسماً لتسمع حكايته.',
      mapAll: 'الكل',
      mapHistory: 'تاريخ',
      mapFood: 'طعام',
      mapMusic: 'موسيقى',
      mapHookah: 'مقهى',
      mapLiving: 'حياة',
      mapReset: 'أظهر كل العلامات',
      mapLoading: 'جارٍ تحميل الأطلس…',
      foodHeading: 'المائدة المصرية',
      foodLead: 'كشري وفول وطعمية وكنافة — اقلب الطبق لتعرف أصله ومعناه.',
      musicHeading: 'صوت مصر',
      musicLead: 'أم كلثوم والطرب والشعبي الصعيدي وليالي القاهرة. اقلب البطاقة لتقرأ الحكاية.',
      hookahHeading: 'المقهى — شاي وقهوة وحديث بطيء',
      hookahLead: 'طاولات القهوة وجمر الشيشة وحديث المساء — القاهرة والإسكندرية كأثاث اجتماعي.',
      livingHeading: 'ثقافات حيّة',
      livingLead: 'ذاكرة النيل والخط والأسواق والفلكات والأقباط وضيافة سيناء.',
      phraseHeading: 'احكِ مصري',
      phraseLead: 'تحيات عربية مصرية يومية تُسمَع في مصر. اضغط أي عبارة لتسمعها.',
      flipHint: 'اقلب البطاقة للحكاية',
      playMusic: 'شغّل المقطع',
      stopMusic: 'أوقف المقطع',
      back: 'رجوع',
      loading: 'جارٍ تحميل الأطلس…',
      readMore: 'اقرأ الحكاية كاملة',
      close: 'إغلاق',
      unesco: 'تراث عالمي — اليونسكو',
      context: 'السياق',
      evidence: 'على الأرض',
      startTour: 'جولة مصوّرة',
      meetGuide: 'تعرّف على عمر'
    }
  },
  eras: [
    {
      id: 'predynastic',
      siteId: 'memphis',
      yearCE: -3100,
      years: b('c. 4000–2686 BCE', 'نحو ٤٠٠٠–٢٦٨٦ ق.م'),
      title: b('Predynastic & Early Dynastic', 'ما قبل الأسرات والمبكرة'),
      copy: b('Villages unify along the Nile; kings claim the Two Lands.', 'قرى تتوحّد على النيل؛ ملوك يدّعون الأرضين.'),
      narration: b(
        'We begin before the pyramids. Predynastic and Early Dynastic Egypt saw villages along the Nile join into a kingdom of Upper and Lower Egypt — the Two Lands under one crown.',
        'نبدأ قبل الأهرام. شهدت مصر ما قبل الأسرات والأسرات المبكرة انضمام قرى النيل إلى مملكة الوجهين القبلي والبحري — الأرضان تحت تاج واحد.'
      ),
      history: b(
        'Neolithic farming communities along the Nile developed distinctive pottery, burial customs, and regional centers. Around 3100 BCE tradition credits Narmer (or Menes) with unifying Upper and Lower Egypt. Early Dynastic capitals near Memphis organized irrigation, writing, and royal ideology that framed later dynasties.',
        'طورت مجتمعات زراعية نيوليتية على النيل فخاراً وطقوس دفن ومراكز إقليمية مميزة. نحو ٣١٠٠ ق.م ينسب التقليد إلى نعرمر (أو مينا) توحيد الوجهين. نظّمت عواصم الأسرات المبكرة قرب منف الري والكتابة والأيديولوجيا الملكية التي أطّرت الأسرات اللاحقة.'
      ),
      image: '/egypt/assets/era/predynastic.jpg'
    },
    {
      id: 'old-kingdom',
      siteId: 'giza',
      yearCE: -2550,
      years: b('c. 2686–2181 BCE', 'نحو ٢٦٨٦–٢١٨١ ق.م'),
      title: b('Old Kingdom — pyramids', 'الدولة القديمة — الأهرام'),
      copy: b('Stone mountains for kings at Giza, Saqqara, and Dahshur.', 'جبال حجر لملوك في الجيزة وسقارة ودهشور.'),
      narration: b(
        'Next, the Old Kingdom. At Giza the Great Pyramid and its companions rise as eternal stone. Nearby Saqqara and Dahshur show how pyramid architecture learned its craft.',
        'ثم الدولة القديمة. في الجيزة يرتفع الهرم الأكبر ورفقاؤه كحجر خالد. وتُظهر سقارة ودهشور القريبتان كيف تعلّم عمارة الأهرام حِرفتها.'
      ),
      history: b(
        'Old Kingdom pharaohs centralized the state around Memphis and built monumental pyramids as royal tombs and cosmological statements. The Step Pyramid of Djoser at Saqqara, Sneferu’s bent and red pyramids at Dahshur, and Khufu’s Great Pyramid at Giza mark engineering peaks. Provincial nomes, temple economies, and a literate bureaucracy supported the court.',
        'ركّز فراعنة الدولة القديمة الدولة حول منف وبنوا أهراماً ضخمة كمقابر ملكية وبيانات كونية. يُعلّم هرم زوسر المدرّج في سقارة وأهرام سنفرو المنحنية والحمراء في دهشور وهرم خوفو الأكبر في الجيزة قمم الهندسة. دعمت الأقاليم واقتصادات المعابد وبيروقراطية قارئة البلاط.'
      ),
      image: '/egypt/assets/era/old-kingdom.jpg'
    },
    {
      id: 'new-kingdom',
      siteId: 'luxor',
      yearCE: -1250,
      years: b('c. 1550–1070 BCE', 'نحو ١٥٥٠–١٠٧٠ ق.م'),
      title: b('New Kingdom — empire of temples', 'الدولة الحديثة — إمبراطورية المعابد'),
      copy: b('Thebes, Karnak, and the Valley of the Kings.', 'طيبة والكرنك ووادي الملوك.'),
      narration: b(
        'The New Kingdom made Thebes a ritual capital. Karnak’s pylons, Luxor Temple, and the Valley of the Kings still hold the empire’s most famous stones and tombs.',
        'جعلت الدولة الحديثة طيبة عاصمة طقسية. ما زالت أبراج الكرنك ومعبد الأقصر ووادي الملوك تحمل أشهر حجارة الإمبراطورية ومقابرها.'
      ),
      history: b(
        'After the Second Intermediate Period, New Kingdom rulers expanded Egypt’s influence into Nubia and the Levant. Amun’s temple complex at Karnak and the royal necropolis west of Thebes became ideological centers. Hatshepsut, Thutmose III, Akhenaten, Tutankhamun, and Ramesses II are among the period’s most studied figures. Abu Simbel later projected Ramesside power into Nubia.',
        'بعد الفترة الانتقالية الثانية وسّع حكام الدولة الحديثة نفوذ مصر إلى النوبة والشام. صار مجمع آمون في الكرنك والمقبرة الملكية غرب طيبة مراكز أيديولوجية. حتشبسوت وتحتمس الثالث وأخناتون وتوت عنخ آمون ورمسيس الثاني من أبرز شخصيات الحقبة. وعكس أبو سمبل لاحقاً القوة الرمسيسية في النوبة.'
      ),
      image: '/egypt/assets/era/new-kingdom.jpg'
    },
    {
      id: 'late-ptolemaic',
      siteId: 'alexandria',
      yearCE: -100,
      years: b('c. 664–30 BCE', 'نحو ٦٦٤–٣٠ ق.م'),
      title: b('Late Period & Ptolemaic', 'العصر المتأخر والبطلمي'),
      copy: b('Persian interludes, then Greek kings and Cleopatra’s Alexandria.', 'فترات فارسية ثم ملوك يونان وإسكندرية كليوباترا.'),
      narration: b(
        'In the Late Period and under the Ptolemies, Egypt’s court moved toward the Mediterranean. Alexandria became a lighthouse of learning — until Rome ended Ptolemaic rule in 30 BCE.',
        'في العصر المتأخر وتحت البطالمة مالت البلاط نحو المتوسط. صارت الإسكندرية منارة علم — حتى أنهت روما الحكم البطلمي سنة ٣٠ ق.م.'
      ),
      history: b(
        'Late Period dynasties restored native rule between Assyrian and Persian occupations. Alexander’s conquest (332 BCE) opened Macedonian rule; the Ptolemaic dynasty founded Alexandria as capital, blending Egyptian temple cult with Hellenistic scholarship. Cleopatra VII’s alliance with Rome ended with Octavian’s victory and Egypt’s annexation as a Roman province.',
        'أعادت أسر العصر المتأخر الحكم الوطني بين الاحتلالين الآشوري والفارسي. فتح غزو الإسكندر (٣٣٢ ق.م) الحكم المقدوني؛ وأسّست الأسرة البطلمية الإسكندرية عاصمة تمزج عبادة المعابد المصرية بالعلم الهلنستي. انتهت تحالفات كليوباترا السابعة مع روما بانتصار أوكتافيان وضم مصر ولاية رومانية.'
      ),
      image: '/egypt/assets/era/late-ptolemaic.jpg'
    },
    {
      id: 'roman-byzantine',
      siteId: 'alexandria',
      yearCE: 300,
      years: b('30 BCE–642 CE', '٣٠ ق.م–٦٤٢ م'),
      title: b('Roman & Byzantine Egypt', 'مصر الرومانية والبيزنطية'),
      copy: b('Grain for empire, Christian Egypt, and late antique cities.', 'قمح للإمبراطورية ومصر مسيحية ومدن متأخرة عتيقة.'),
      narration: b(
        'Under Rome and Byzantium, Egypt fed the empire with Nile grain. Alexandria remained a great city; Coptic Christianity took deep root before the Arab-Islamic conquest.',
        'تحت روما وبيزنطة غذّت مصر الإمبراطورية بقمح النيل. بقيت الإسكندرية مدينة عظيمة؛ وتجذّرت المسيحية القبطية قبل الفتح العربي الإسلامي.'
      ),
      history: b(
        'Roman Egypt was an imperial province prized for grain and trade. Greco-Roman cities, temple conversions, and later monastic communities reshaped the religious landscape. Byzantine administration faced Persian occupation and then the Arab conquest of the 640s. Coptic language and church institutions preserved a distinct Egyptian Christian identity.',
        'كانت مصر الرومانية ولاية إمبراطورية ثمينة للقمح والتجارة. أعادت مدن يونانية رومانية وتحويلات المعابد ثم الجماعات الرهبانية تشكيل المشهد الديني. واجهت الإدارة البيزنطية الاحتلال الفارسي ثم الفتح العربي في الأربعينيات من القرن السابع. حفظت اللغة القبطية ومؤسسات الكنيسة هوية مسيحية مصرية مميزة.'
      ),
      image: '/egypt/assets/era/roman-byzantine.jpg'
    },
    {
      id: 'islamic-fatimid',
      siteId: 'islamic-cairo',
      yearCE: 970,
      years: b('641–1171 CE', '٦٤١–١١٧١ م'),
      title: b('Islamic & Fatimid Cairo', 'الإسلامية والقاهرة الفاطمية'),
      copy: b('Al-Azhar, new capitals, and a city of learning.', 'الأزهر وعواصم جديدة ومدينة علم.'),
      narration: b(
        'Islamic Egypt founded new capitals that became Cairo. Under the Fatimids, Al-Azhar rose as a mosque and school — still a living center of learning.',
        'أسّست مصر الإسلامية عواصم جديدة صارت القاهرة. تحت الفاطميين ارتفع الأزهر مسجداً ومدرسة — ما زال مركزاً حياً للعلم.'
      ),
      history: b(
        'After the Arab conquest, governors ruled from Fustat and later capitals. The Fatimid caliphate founded al-Qāhira (Cairo) in 969 CE and established Al-Azhar Mosque (970). Historic Cairo’s mosques, gates, and markets grew into one of the Islamic world’s great urban cores — today a UNESCO World Heritage site.',
        'بعد الفتح العربي حكم الولاة من الفسطاط ثم عواصم لاحقة. أسّست الخلافة الفاطمية القاهرة سنة ٩٦٩ م وأقامت جامع الأزهر (٩٧٠). نمت مساجد القاهرة التاريخية وأبوابها وأسواقها إلى أحد أعظم المراكز الحضرية في العالم الإسلامي — وهي اليوم موقع تراث عالمي لليونسكو.'
      ),
      image: '/egypt/assets/era/islamic-fatimid.jpg'
    },
    {
      id: 'mamluk',
      siteId: 'islamic-cairo',
      yearCE: 1350,
      years: b('1250–1517 CE', '١٢٥٠–١٥١٧ م'),
      title: b('Mamluk Cairo', 'القاهرة المملوكية'),
      copy: b('Sultans, madrasas, and monumental stone streets.', 'سلاطين ومدارس وشوارع حجر ضخمة.'),
      narration: b(
        'Mamluk sultans made Cairo a capital of architecture and trade. Madrasas, domes, and caravanserais still line the historic streets.',
        'جعل سلاطين المماليك القاهرة عاصمة عمارة وتجارة. ما زالت المدارس والقباب والوكالات تصفّ الشوارع التاريخية.'
      ),
      history: b(
        'The Mamluk sultanate defeated Mongol advance at ʿAyn Jālūt and ruled Egypt and Syria from Cairo. Patronage produced dense religious complexes, ablution courts, and commercial streets. Endowment (waqf) economies funded education and charity. Ottoman conquest in 1517 ended Mamluk sovereignty but left the city’s stone grammar intact.',
        'هزم السلطان المملوكي الزحف المغولي في عين جالوت وحكم مصر والشام من القاهرة. أنتج الرعاة مجمعات دينية كثيفة وأحواض وضوء وشوارع تجارية. موّلت اقتصادات الوقف التعليم والصدقة. أنهى الفتح العثماني سنة ١٥١٧ السيادة المملوكية لكن أبقى نحو المدينة الحجري سليماً.'
      ),
      image: '/egypt/assets/era/mamluk.jpg'
    },
    {
      id: 'ottoman',
      siteId: 'cairo',
      yearCE: 1600,
      years: b('1517–1805 CE', '١٥١٧–١٨٠٥ م'),
      title: b('Ottoman Egypt', 'مصر العثمانية'),
      copy: b('Province of empire — ports, scholars, and local households.', 'ولاية إمبراطورية — موانئ وعلماء وبيوت محلية.'),
      narration: b(
        'Under the Ottomans, Egypt remained a rich province. Cairo’s scholars and merchants kept the city’s pulse while Istanbul held the far throne.',
        'تحت العثمانيين بقيت مصر ولاية غنية. حافظ علماء القاهرة وتجارها على نبض المدينة بينما بقي العرش البعيد في إسطنبول.'
      ),
      history: b(
        'Ottoman Egypt linked Red Sea and Mediterranean trade to imperial networks. Local Mamluk households and Ottoman governors shared power in shifting balances. Al-Azhar continued as a scholarly hub. Coffeehouses, printing later in the century, and pilgrimage routes through Egypt shaped urban life until Muhammad Ali’s rise.',
        'ربطت مصر العثمانية تجارة البحر الأحمر والمتوسط بشبكات الإمبراطورية. تقاسمت بيوت مملوكية محلية وولاة عثمانيون السلطة بتوازنات متغيّرة. بقي الأزهر مركزاً علمياً. شكّلت المقاهي والطباعة لاحقاً وطرق الحج عبر مصر حياة المدينة حتى صعود محمد علي.'
      ),
      image: '/egypt/assets/era/ottoman.jpg'
    },
    {
      id: 'muhammad-ali',
      siteId: 'cairo',
      yearCE: 1830,
      years: b('1805–1952 CE', '١٨٠٥–١٩٥٢ م'),
      title: b('Muhammad Ali & Khedival', 'محمد علي والخديوية'),
      copy: b('Modernizing state, cotton, and a new Cairo skyline.', 'دولة تحديث وقطن وأفق قاهري جديد.'),
      narration: b(
        'Muhammad Ali and the Khedives remade Egypt’s army, irrigation, and cities. Cairo’s boulevards and Alexandria’s waterfront still carry that nineteenth-century ambition.',
        'أعاد محمد علي والخديويون تشكيل جيش مصر وريّها ومدنها. ما زالت شوارع القاهرة الواسعة وواجهة الإسكندرية تحمل طموح القرن التاسع عشر.'
      ),
      history: b(
        'Muhammad Ali Pasha (r. 1805–1848) built a modernizing state with conscription, factories, and Nile irrigation works. Later Khedives expanded cotton export economies and European-style urban planning. British occupation from 1882 constrained sovereignty while Cairo and Alexandria grew as cosmopolitan capitals. Nationalist movements gathered force through the early twentieth century.',
        'بنى محمد علي باشا (حكم ١٨٠٥–١٨٤٨) دولة تحديث بالتجنيد والمصانع وأعمال ري النيل. وسّع الخديويون لاحقاً اقتصادات تصدير القطن والتخطيط الحضري على الطراز الأوروبي. قيّد الاحتلال البريطاني من ١٨٨٢ السيادة بينما نمت القاهرة والإسكندرية كعواصم عالمية. وتجمّعت الحركات الوطنية عبر أوائل القرن العشرين.'
      ),
      image: '/egypt/assets/era/muhammad-ali.jpg'
    },
    {
      id: 'contemporary',
      siteId: 'cairo',
      yearCE: 1953,
      years: b('1952–present', '١٩٥٢–اليوم'),
      title: b('Contemporary republic', 'الجمهورية المعاصرة'),
      copy: b('Revolution, republic, and a megacity on the Nile.', 'ثورة وجمهورية ومدينة عملاقة على النيل.'),
      narration: b(
        'The contemporary republic begins with the 1952 revolution. Cairo today is a megacity of song, film, and daily table — still telling Egypt’s story aloud.',
        'تبدأ الجمهورية المعاصرة بثورة ١٩٥٢. القاهرة اليوم مدينة عملاقة للأغنية والسينما والمائدة اليومية — ما زالت تروي حكاية مصر بصوت عالٍ.'
      ),
      history: b(
        'The Free Officers’ revolution of 1952 ended the monarchy; the republic under Nasser and successors reshaped education, industry, and regional politics. Cairo and Alexandria remain cultural engines of Arabic media and music. Tourism, archaeology, and living neighborhoods share the same landscape of Nile, desert, and Red Sea coasts.',
        'أنهت ثورة الضباط الأحرار سنة ١٩٥٢ الملكية؛ وأعادت الجمهورية تحت عبد الناصر وخلفائه تشكيل التعليم والصناعة والسياسة الإقليمية. تبقى القاهرة والإسكندرية محركات ثقافية للإعلام والموسيقى العربية. يتشارك السياحة والآثار والأحياء الحيّة المشهد نفسه من النيل والصحراء وسواحل البحر الأحمر.'
      ),
      image: '/egypt/assets/era/contemporary.jpg'
    }
  ],
  sites: [
    {
      id: 'cairo',
      category: 'history',
      emoji: '🕌',
      lat: 30.0444,
      lng: 31.2357,
      unesco: false,
      name: b('Cairo', 'القاهرة'),
      place: b('Capital on the Nile', 'العاصمة على النيل'),
      blurb: b('Megacity of museums, mosques, and film.', 'مدينة عملاقة للمتاحف والمساجد والسينما.')
    },
    {
      id: 'giza',
      category: 'history',
      emoji: '🔺',
      lat: 29.9792,
      lng: 31.1342,
      unesco: true,
      name: b('Giza', 'الجيزة'),
      place: b('Pyramid plateau', 'هضبة الأهرام'),
      blurb: b('Great Pyramid and Sphinx on the desert edge.', 'الهرم الأكبر وأبو الهول على حافة الصحراء.')
    },
    {
      id: 'luxor',
      category: 'history',
      emoji: '🏛️',
      lat: 25.6872,
      lng: 32.6396,
      unesco: true,
      name: b('Luxor', 'الأقصر'),
      place: b('Ancient Thebes', 'طيبة القديمة'),
      blurb: b('Temple city on both banks of the Nile.', 'مدينة معابد على ضفتي النيل.')
    },
    {
      id: 'karnak',
      category: 'history',
      emoji: '⛩️',
      lat: 25.7188,
      lng: 32.6573,
      unesco: true,
      name: b('Karnak', 'الكرنك'),
      place: b('Temple of Amun', 'معبد آمون'),
      blurb: b('Vast sacred complex of pylons and hypostyle hall.', 'مجمع مقدّس هائل من الأبراج وقاعة الأعمدة.')
    },
    {
      id: 'valley-of-kings',
      category: 'history',
      emoji: '⚰️',
      lat: 25.7402,
      lng: 32.6014,
      unesco: true,
      name: b('Valley of the Kings', 'وادي الملوك'),
      place: b('West bank Thebes', 'الضفة الغربية لطيبة'),
      blurb: b('Royal tombs cut into limestone hills.', 'مقابر ملكية منحوتة في تلال الحجر الجيري.')
    },
    {
      id: 'aswan',
      category: 'history',
      emoji: '⛵',
      lat: 24.0889,
      lng: 32.8998,
      unesco: false,
      name: b('Aswan', 'أسوان'),
      place: b('First Cataract', 'الشلال الأول'),
      blurb: b('Granite quarries, Nubian light, and Nile islands.', 'محاجر جرانيت وضوء نوبي وجزر النيل.')
    },
    {
      id: 'abu-simbel',
      category: 'history',
      emoji: '🗿',
      lat: 22.3372,
      lng: 31.6258,
      unesco: true,
      name: b('Abu Simbel', 'أبو سمبل'),
      place: b('Nubian cliff temples', 'معابد الجرف النوبية'),
      blurb: b('Ramesses II’s colossi rescued above the lake.', 'تماثيل رمسيس الثاني العملاقة أُنقذت فوق البحيرة.')
    },
    {
      id: 'alexandria',
      category: 'history',
      emoji: '🌊',
      lat: 31.2001,
      lng: 29.9187,
      unesco: false,
      name: b('Alexandria', 'الإسكندرية'),
      place: b('Mediterranean capital', 'عاصمة المتوسط'),
      blurb: b('Ptolemaic port of libraries, corniche, and wind.', 'ميناء بطلمي للمكتبات والكورنيش والريح.')
    },
    {
      id: 'siwa',
      category: 'living',
      emoji: '🌴',
      lat: 29.2032,
      lng: 25.5195,
      unesco: false,
      name: b('Siwa', 'سيوة'),
      place: b('Western Desert oasis', 'واحة الصحراء الغربية'),
      blurb: b('Date palms, salt lakes, and Amazigh heritage.', 'نخيل وبحيرات ملح وتراث أمازيغي.')
    },
    {
      id: 'fayoum',
      category: 'living',
      emoji: '🌾',
      lat: 29.3084,
      lng: 30.8428,
      unesco: false,
      name: b('Fayoum', 'الفيوم'),
      place: b('Oasis depression', 'منخفض الواحة'),
      blurb: b('Lake Qarun, waterwheels, and desert edge farms.', 'بحيرة قارون وسواقي ومزارع حافة الصحراء.')
    },
    {
      id: 'philae',
      category: 'history',
      emoji: '🏝️',
      lat: 24.0256,
      lng: 32.8845,
      unesco: true,
      name: b('Philae', 'فيله'),
      place: b('Island of Isis', 'جزيرة إيزيس'),
      blurb: b('Temple relocated above the High Dam waters.', 'معبد نُقل فوق مياه السد العالي.')
    },
    {
      id: 'edfu',
      category: 'history',
      emoji: '🦅',
      lat: 24.9779,
      lng: 32.8734,
      unesco: false,
      name: b('Edfu', 'إدفو'),
      place: b('Temple of Horus', 'معبد حورس'),
      blurb: b('One of Egypt’s best-preserved Ptolemaic temples.', 'من أفضل المعابد البطلمية حفظاً في مصر.')
    },
    {
      id: 'kom-ombo',
      category: 'history',
      emoji: '🐊',
      lat: 24.4525,
      lng: 32.9283,
      unesco: false,
      name: b('Kom Ombo', 'كوم أمبو'),
      place: b('Double temple', 'المعبد المزدوج'),
      blurb: b('Shared sanctuary of Sobek and Horus the Elder.', 'مقدّس مشترك لسوبك وحورس الأكبر.')
    },
    {
      id: 'islamic-cairo',
      category: 'history',
      emoji: '🏰',
      lat: 30.0459,
      lng: 31.2625,
      unesco: true,
      name: b('Islamic Cairo', 'القاهرة الإسلامية'),
      place: b('Historic core', 'النواة التاريخية'),
      blurb: b('Al-Azhar, gates, and UNESCO Historic Cairo.', 'الأزهر والأبواب والقاهرة التاريخية في اليونسكو.')
    },
    {
      id: 'saqqara',
      category: 'history',
      emoji: '📶',
      lat: 29.8714,
      lng: 31.2165,
      unesco: true,
      name: b('Saqqara', 'سقارة'),
      place: b('Memphite necropolis', 'جبّانة منف'),
      blurb: b('Djoser’s Step Pyramid and vast burial fields.', 'هرم زوسر المدرّج وحقول دفن واسعة.')
    },
    {
      id: 'dahshur',
      category: 'history',
      emoji: '🔶',
      lat: 29.7903,
      lng: 31.2214,
      unesco: true,
      name: b('Dahshur', 'دهشور'),
      place: b('Bent and Red Pyramids', 'الهرم المنحني والأحمر'),
      blurb: b('Sneferu’s experiments that taught true pyramids.', 'تجارب سنفرو التي علّمت الأهرام الحقيقية.')
    },
    {
      id: 'hurghada',
      category: 'living',
      emoji: '🪸',
      lat: 27.2579,
      lng: 33.8116,
      unesco: false,
      name: b('Hurghada', 'الغردقة'),
      place: b('Red Sea coast', 'ساحل البحر الأحمر'),
      blurb: b('Coral reefs and desert meeting the sea.', 'شعاب مرجانية وصحراء تلتقي البحر.')
    },
    {
      id: 'st-catherine',
      category: 'history',
      emoji: '⛰️',
      lat: 28.556,
      lng: 33.975,
      unesco: true,
      name: b('St Catherine', 'سانت كاترين'),
      place: b('South Sinai', 'جنوب سيناء'),
      blurb: b('Monastery and sacred mountain landscape.', 'دير ومشهد جبلي مقدّس.')
    },
    {
      id: 'rosetta',
      category: 'history',
      emoji: '📜',
      lat: 31.4015,
      lng: 30.4173,
      unesco: false,
      name: b('Rosetta', 'رشيد'),
      place: b('Nile Delta mouth', 'مصب الدلتا'),
      blurb: b('Where the Rosetta Stone unlocked hieroglyphs.', 'حيث فتحت حجر رشيد أقفال الهيروغليفية.')
    },
    {
      id: 'memphis',
      category: 'history',
      emoji: '🏺',
      lat: 29.8447,
      lng: 31.2508,
      unesco: true,
      name: b('Memphis', 'منف'),
      place: b('First capital region', 'منطقة العاصمة الأولى'),
      blurb: b('Ancient capital whose necropolis still speaks.', 'عاصمة قديمة ما زالت جبانتها تتكلم.')
    },
    {
      id: 'khan-el-khalili',
      category: 'food',
      emoji: '🫖',
      lat: 30.0478,
      lng: 31.2622,
      unesco: false,
      name: b('Khan el-Khalili', 'خان الخليلي'),
      place: b('Cairo souq', 'سوق القاهرة'),
      blurb: b('Tea, crafts, and the pulse of the bazaar.', 'شاي وحِرَف ونبض السوق.')
    },
    {
      id: 'cairo-opera',
      category: 'music',
      emoji: '🎵',
      lat: 30.0425,
      lng: 31.224,
      unesco: false,
      name: b('Cairo Opera House', 'دار الأوبرا المصرية'),
      place: b('Gezira Island', 'جزيرة الزمالك'),
      blurb: b('Stage for tarab, orchestra, and modern song.', 'خشبة للطرب والأوركسترا والأغنية الحديثة.')
    }
  ],
  foods: [
    {
      id: 'koshari',
      emoji: '🍝',
      siteId: 'cairo',
      name: b('Koshari', 'كشري'),
      tagline: b('Rice, lentils, pasta, and spicy tomato', 'أرز وعدس ومكرونة وصلصة حارة'),
      history: b(
        'Egypt’s great street bowl stacks rice, lentils, chickpeas, and pasta under tomato sauce and fried onions. Born of thrift and urban hunger, koshari is democracy in a plate.',
        'طبق الشارع العظيم في مصر يرصّ الأرز والعدس والحمص والمكرونة تحت صلصة طماطم وبصل مقلي. وُلد من الاقتصاد والجوع الحضري، والكشري ديمقراطية في طبق.'
      ),
      tags: tags(['Street', 'Rice', 'Cairo'], ['شارع', 'أرز', 'قاهرة']),
      image: '/egypt/assets/food/koshari.jpg'
    },
    {
      id: 'ful-medames',
      emoji: '🫘',
      siteId: 'cairo',
      name: b('Ful medames', 'فول مدمس'),
      tagline: b('Slow-stewed fava beans of the morning', 'فول الصباح المطهو ببطء'),
      history: b(
        'Fava beans simmer overnight with oil, lemon, and cumin. Ful is breakfast across Egypt — cheap protein shared from street carts to home tables.',
        'يُطهى الفول طوال الليل بالزيت والليمون والكمون. الفول فطور مصر — بروتين رخيص من عربات الشارع إلى موائد البيوت.'
      ),
      tags: tags(['Breakfast', 'Beans', 'Daily'], ['فطور', 'فول', 'يومي']),
      image: '/egypt/assets/food/ful-medames.jpg'
    },
    {
      id: 'taameya',
      emoji: '🥙',
      siteId: 'cairo',
      name: b('Taameya', 'طعمية'),
      tagline: b('Egyptian falafel of green fava', 'فلافل مصرية من الفول الأخضر'),
      history: b(
        'Unlike chickpea falafel elsewhere, Egyptian taameya is ground green fava with herbs, fried crisp. Sandwiched in baladi bread, it is morning and midnight food.',
        'بخلاف فلافل الحمص في أماكن أخرى، الطعمية المصرية فول أخضر مطحون بالأعشاب ومقلي مقرمش. في العيش البلدي هي طعام الصباح ومنتصف الليل.'
      ),
      tags: tags(['Fried', 'Street', 'Herbs'], ['مقلي', 'شارع', 'أعشاب']),
      image: '/egypt/assets/food/taameya.jpg'
    },
    {
      id: 'molokhia',
      emoji: '🥬',
      siteId: 'fayoum',
      name: b('Molokhia', 'ملوخية'),
      tagline: b('Green leaf stew with garlic and coriander', 'يخنة ورق أخضر بالثوم والكزبرة'),
      history: b(
        'Finely chopped jute leaves cook into a silky green soup, often with rabbit or chicken. The garlic-coriander taqliya tempering is the aroma of Egyptian kitchens.',
        'يُطهى ورق الملوخية المفروم ناعماً إلى شوربة خضراء حريرية، غالباً مع أرنب أو دجاج. تتبيلة الثوم والكزبرة هي عطر المطابخ المصرية.'
      ),
      tags: tags(['Stew', 'Greens', 'Home'], ['يخنة', 'خضار', 'بيت']),
      image: '/egypt/assets/food/molokhia.jpg'
    },
    {
      id: 'fatteh',
      emoji: '🫓',
      siteId: 'cairo',
      name: b('Fatteh', 'فتّة'),
      tagline: b('Layered bread, rice, and garlic yogurt', 'طبقات خبز وأرز ولبن بالثوم'),
      history: b(
        'Crisp bread, rice, meat or chickpeas, and garlicky yogurt stack into feast food. Egyptian fatteh marks celebrations and Friday tables.',
        'خبز مقرمش وأرز ولحم أو حمص ولبن بالثوم تُرصّ لطعام العيد. تعلّم الفتّة المصرية موائد الاحتفال والجمعة.'
      ),
      tags: tags(['Feast', 'Bread', 'Yogurt'], ['عيد', 'خبز', 'لبن']),
      image: '/egypt/assets/food/fatteh.jpg'
    },
    {
      id: 'mahshi',
      emoji: '🫑',
      siteId: 'cairo',
      name: b('Mahshi', 'محشي'),
      tagline: b('Vegetables stuffed with herb rice', 'خضار محشوة بأرز وأعشاب'),
      history: b(
        'Zucchini, peppers, vine leaves, and cabbage filled with rice, dill, and tomato. Mahshi trays are family labor — many hands, one oven.',
        'كوسة وفلفل وورق عنب وكرنب تُحشى بالأرز والشبت والطماطم. صواني المحشي عمل عائلي — أيدٍ كثيرة وفرن واحد.'
      ),
      tags: tags(['Stuffed', 'Family', 'Rice'], ['محشي', 'عائلة', 'أرز']),
      image: '/egypt/assets/food/mahshi.jpg'
    },
    {
      id: 'hawawshi',
      emoji: '🥖',
      siteId: 'khan-el-khalili',
      name: b('Hawawshi', 'حواوشي'),
      tagline: b('Spiced minced meat baked in baladi bread', 'لحم مفروم متبّل في عيش بلدي'),
      history: b(
        'Minced beef or lamb with onion, pepper, and spices is sealed inside pita and baked until the bread crisps. Hawawshi is Cairo’s portable feast.',
        'لحم بقري أو ضأن مفروم مع بصل وفلفل وتوابل يُغلق داخل العيش ويُخبز حتى يقرمش. الحواوشي وليمة القاهرة المحمولة.'
      ),
      tags: tags(['Meat', 'Bread', 'Street'], ['لحم', 'خبز', 'شارع']),
      image: '/egypt/assets/food/hawawshi.jpg'
    },
    {
      id: 'basbousa',
      emoji: '🍰',
      siteId: 'alexandria',
      name: b('Basbousa', 'بسبوسة'),
      tagline: b('Semolina cake soaked in syrup', 'كعكة سميد منقوعة بالقطر'),
      history: b(
        'Semolina batter baked, then flooded with sugar syrup — often with coconut or almonds. Basbousa sweetens café trays and Ramadan nights.',
        'عجينة سميد تُخبز ثم تُغرق بقطر السكر — غالباً بجوز هند أو لوز. تحلّي البسبوسة صواني المقاهي وليالي رمضان.'
      ),
      tags: tags(['Sweet', 'Semolina', 'Café'], ['حلوى', 'سميد', 'مقهى']),
      image: '/egypt/assets/food/basbousa.jpg'
    },
    {
      id: 'konafa',
      emoji: '🧀',
      siteId: 'khan-el-khalili',
      name: b('Konafa', 'كنافة'),
      tagline: b('Shredded pastry with cheese or nuts', 'عجينة مبرومة بجبن أو مكسرات'),
      history: b(
        'Fine pastry threads crisp around soft cheese or nuts, then meet hot syrup. Egyptian konafa is Ramadan and celebration sugar.',
        'خيوط عجينة رفيعة تقرمش حول جبن طري أو مكسرات ثم تلتقي بالقطر الساخن. الكنافة المصرية سكر رمضان والاحتفال.'
      ),
      tags: tags(['Sweet', 'Ramadan', 'Cheese'], ['حلوى', 'رمضان', 'جبن']),
      image: '/egypt/assets/food/konafa.jpg'
    },
    {
      id: 'feteer',
      emoji: '🥐',
      siteId: 'fayoum',
      name: b('Feteer', 'فطير'),
      tagline: b('Layered pastry — sweet or savory', 'عجينة طبقات — حلوة أو مالحة'),
      history: b(
        'Paper-thin dough stretched and folded with ghee, filled with cheese, meats, or honey-nuts. Feteer mesheshy is Egypt’s flaky feast bread.',
        'عجينة رقيقة كالشرشف تُمدّ وتُطوى بالسمن وتُحشى بجبن أو لحوم أو عسل ومكسرات. الفطير المشلتت خبز الوليمة المقرمش في مصر.'
      ),
      tags: tags(['Pastry', 'Feast', 'Layers'], ['فطير', 'عيد', 'طبقات']),
      image: '/egypt/assets/food/feteer.jpg'
    },
    {
      id: 'umm-ali',
      emoji: '🥛',
      siteId: 'cairo',
      name: b('Umm Ali', 'أم علي'),
      tagline: b('Bread pudding of milk, nuts, and spice', 'بودنغ خبز بالحليب والمكسرات'),
      history: b(
        'Torn pastry or bread baked with milk, cream, raisins, and nuts until golden. Legend names it for a medieval princess — the dessert is pure comfort.',
        'قطع عجين أو خبز تُخبز بالحليب والقشطة والزبيب والمكسرات حتى تذهبّ. الأسطورة تنسبها لأميرة — والحلوى راحة خالصة.'
      ),
      tags: tags(['Sweet', 'Milk', 'Comfort'], ['حلوى', 'حليب', 'راحة']),
      image: '/egypt/assets/food/umm-ali.jpg'
    },
    {
      id: 'tea-shai',
      emoji: '🍵',
      siteId: 'khan-el-khalili',
      name: b('Shai', 'شاي'),
      tagline: b('Strong Egyptian tea — often with mint', 'شاي مصري قوي — غالباً بالنعناع'),
      history: b(
        'Black tea, heavily sweetened, poured in glasses — with mint or without. Shai organizes ahwa talk, shop bargains, and friendship across Egypt.',
        'شاي أسود يُحلّى كثيراً ويُصب في كؤوس — بنعناع أو بدونه. ينظّم الشاي حديث القهوة ومساومة الدكان والصداقة عبر مصر.'
      ),
      tags: tags(['Tea', 'Café', 'Daily'], ['شاي', 'مقهى', 'يومي']),
      image: '/egypt/assets/food/tea-shai.jpg'
    }
  ],
  music: [
    {
      id: 'um-kulthum',
      emoji: '🎤',
      siteId: 'cairo-opera',
      name: b('Umm Kulthum', 'أم كلثوم'),
      tagline: b('The voice that held the Arab world', 'الصوت الذي أمسك العالم العربي'),
      history: b(
        'Umm Kulthum’s long-form songs and Thursday radio concerts made Cairo the capital of tarab. Her repertoire still defines Egyptian classical popular song.',
        'جعلت أغاني أم كلثوم الطويلة وحفلات خميس الراديو القاهرة عاصمة الطرب. ما زال رصيدها يعرّف الأغنية الشعبية الكلاسيكية المصرية.'
      ),
      tags: tags(['Tarab', 'Voice', 'Cairo'], ['طرب', 'صوت', 'قاهرة']),
      image: '/egypt/assets/music/um-kulthum.jpg'
    },
    {
      id: 'oud-egypt',
      emoji: '🎸',
      siteId: 'cairo',
      name: b('Egyptian oud', 'العود المصري'),
      tagline: b('Lute of salons and film scores', 'عود الصالونات وموسيقى الأفلام'),
      history: b(
        'Cairo’s oud schools shaped Arab lute technique through the twentieth century. The instrument bridges classical maqam, film music, and café improvisation.',
        'شكّلت مدارس عود القاهرة تقنية العود العربي عبر القرن العشرين. والجهاز يصل المقام الكلاسيكي وموسيقى الأفلام وارتجال المقهى.'
      ),
      tags: tags(['Oud', 'Instrument', 'Maqam'], ['عود', 'آلة', 'مقام']),
      image: '/egypt/assets/music/oud-egypt.jpg'
    },
    {
      id: 'tabla',
      emoji: '🥁',
      siteId: 'cairo',
      name: b('Tabla', 'طبلة'),
      tagline: b('Goblet drum of Egyptian rhythm', 'طبل كأسي لإيقاع مصر'),
      history: b(
        'The tabla (darbuka) drives wedding lines, baladi dance, and ensemble grooves. Hands on skin teach the pulse of Cairo streets.',
        'تقود الطبلة (الدربوكة) صفوف الأعراس والرقص البلدي وإيقاعات الفرق. تعلّم الأيدي على الجلد نبض شوارع القاهرة.'
      ),
      tags: tags(['Percussion', 'Dance', 'Rhythm'], ['إيقاع', 'رقص', 'نبض']),
      image: '/egypt/assets/music/tabla.jpg'
    },
    {
      id: 'folk-saidi',
      emoji: '🐴',
      siteId: 'luxor',
      name: b('Saʿidi folk', 'شعبي صعيدي'),
      tagline: b('Upper Egypt stick dance and song', 'رقص عصا وأغنية الصعيد'),
      history: b(
        'Saʿidi song and tahtib stick traditions carry Upper Egyptian pride. Mizmar and tabla announce weddings along the Nile south of Cairo.',
        'تحمل أغنية الصعيد وتقاليد التحطيب فخر الوجه القبلي. يعلن المزمار والطبلة الأعراس على النيل جنوب القاهرة.'
      ),
      tags: tags(['Folk', 'Upper Egypt', 'Dance'], ['شعبي', 'صعيد', 'رقص']),
      image: '/egypt/assets/music/folk-saidi.jpg'
    },
    {
      id: 'mawwal',
      emoji: '🎶',
      siteId: 'alexandria',
      name: b('Mawwal', 'موال'),
      tagline: b('Improvised vocal lament and longing', 'غناء مرتجل للحنين'),
      history: b(
        'The mawwal is free-rhythm singing — often dialect poetry of love and loss — before a measured song begins. It is the singer’s personal breath.',
        'الموال غناء حرّ الإيقاع — غالباً شعر عامية للحب والفقد — قبل أن تبدأ الأغنية الموزونة. هو نفس المغني الشخصي.'
      ),
      tags: tags(['Vocal', 'Improvisation', 'Poetry'], ['غناء', 'ارتجال', 'شعر']),
      image: '/egypt/assets/music/mawwal.jpg'
    },
    {
      id: 'classical-tarab',
      emoji: '🎼',
      siteId: 'cairo-opera',
      name: b('Classical tarab', 'الطرب الكلاسيكي'),
      tagline: b('Takht ensembles and maqam suites', 'فرق التخت ومتتاليات المقام'),
      history: b(
        'Tarab names the aesthetic of emotional enchantment in Arabic art song. Egyptian takht ensembles — oud, qanun, nay, violin, riqq — framed the golden age.',
        'الطرب اسم لجماليات السحر العاطفي في الأغنية العربية الفنية. أطّرت فرق التخت المصرية — عود وقانون وناي وكمان ورق — العصر الذهبي.'
      ),
      tags: tags(['Classical', 'Ensemble', 'Maqam'], ['كلاسيكي', 'فرقة', 'مقام']),
      image: '/egypt/assets/music/classical-tarab.jpg'
    },
    {
      id: 'contemporary-cairo',
      emoji: '🎧',
      siteId: 'cairo',
      name: b('Contemporary Cairo', 'القاهرة المعاصرة'),
      tagline: b('Pop, indie, and new city nights', 'بوب وإندي وليالٍ جديدة'),
      history: b(
        'From mid-century film stars to today’s indie and electronic scenes, Cairo musicians remix shaabi feeling with global forms.',
        'من نجوم سينما منتصف القرن إلى مشاهد الإندي والإلكترونيك اليوم، يعيد موسيقيو القاهرة مزج إحساس الشعبي بأشكال عالمية.'
      ),
      tags: tags(['Pop', 'Urban', 'Fusion'], ['بوب', 'حضري', 'اندماج']),
      image: '/egypt/assets/music/contemporary-cairo.jpg'
    },
    {
      id: 'sufi-dhikr',
      emoji: '📿',
      siteId: 'islamic-cairo',
      name: b('Sufi dhikr', 'ذكر صوفي'),
      tagline: b('Devotional chant and frame drums', 'إنشاد تعبّدي ودفوف'),
      history: b(
        'Sufi orders in Egypt gather for dhikr — rhythmic remembrance of God with voice and percussion. Public mawlids bring that sound into city streets.',
        'تجتمع الطرق الصوفية في مصر للذكر — تذكّر الله بإيقاع الصوت والضرب. تجلب الموالد العامة ذلك الصوت إلى شوارع المدينة.'
      ),
      tags: tags(['Sufi', 'Devotion', 'Rhythm'], ['صوفي', 'تعبّد', 'إيقاع']),
      image: '/egypt/assets/music/sufi-dhikr.jpg'
    },
    {
      id: 'nile-folk',
      emoji: '🚣',
      siteId: 'aswan',
      name: b('Nile folk song', 'أغنية النيل الشعبية'),
      tagline: b('Boatmen, harvest, and river work songs', 'أغاني المراكبية والحصاد والنهر'),
      history: b(
        'Along the Nile, work songs and wedding rhythms travel with feluccas and fields. Nubian and Saʿidi voices color the southern river.',
        'على النيل تسافر أغاني العمل وإيقاعات الأعراس مع الفلكات والحقول. تلوّن الأصوات النوبية والصعيدية النهر الجنوبي.'
      ),
      tags: tags(['Folk', 'Nile', 'Work'], ['شعبي', 'نيل', 'عمل']),
      image: '/egypt/assets/music/nile-folk.jpg'
    },
    {
      id: 'egyptian-pop',
      emoji: '📻',
      siteId: 'cairo',
      name: b('Egyptian pop & shaabi', 'البوب والشعبي المصري'),
      tagline: b('Street shaabi and radio hits', 'شعبي الشارع ونجاحات الراديو'),
      history: b(
        'Shaabi grew from working-class Cairo weddings into a national sound. Later pop stars filled radio and satellite — Egypt still exports the region’s catchiest hooks.',
        'نشأ الشعبي من أعراس القاهرة العمالية إلى صوت وطني. وملأ نجوم البوب لاحقاً الراديو والفضائيات — ما زالت مصر تصدّر أجمل لوازم المنطقة.'
      ),
      tags: tags(['Shaabi', 'Pop', 'Radio'], ['شعبي', 'بوب', 'راديو']),
      image: '/egypt/assets/music/egyptian-pop.jpg'
    }
  ],
  hookah: [
    {
      id: 'cairo-ahwa',
      emoji: '☕',
      siteId: 'cairo',
      name: b('Cairo ahwa', 'قهوة القاهرة'),
      tagline: b('Street café of tea, talk, and backgammon', 'مقهى الشارع للشاي والحديث والطاولة'),
      history: b(
        'The Egyptian ahwa pours shai and coffee for debate, cards, and newspapers. Sit long — the older grammar of Cairo social life.',
        'تصب القهوة المصرية الشاي والقهوة للنقاش والورق والصحف. اجلس طويلاً — القواعد الأقدم لحياة القاهرة الاجتماعية.'
      ),
      tags: tags(['Café', 'Tea', 'Cairo'], ['مقهى', 'شاي', 'قاهرة']),
      image: '/egypt/assets/hookah/cairo-ahwa.jpg'
    },
    {
      id: 'nile-terrace',
      emoji: '🌊',
      siteId: 'cairo',
      name: b('Nile terrace', 'شرفة النيل'),
      tagline: b('River air, late cups, and city lights', 'هواء النهر وفناجين متأخرة وأضواء المدينة'),
      history: b(
        'Corniche and island terraces pair Nile breeze with tea or shisha. The river remains Cairo’s evening living room.',
        'تزوّج شرفات الكورنيش والجزر نسيم النيل بالشاي أو الشيشة. يبقى النهر صالة مساء القاهرة.'
      ),
      tags: tags(['Nile', 'Terrace', 'Evening'], ['نيل', 'شرفة', 'مساء']),
      image: '/egypt/assets/hookah/nile-terrace.jpg'
    },
    {
      id: 'alexandria-cafe',
      emoji: '🌬️',
      siteId: 'alexandria',
      name: b('Alexandria café', 'مقهى الإسكندرية'),
      tagline: b('Corniche wind and Mediterranean cups', 'ريح الكورنيش وفناجين المتوسط'),
      history: b(
        'Alexandria’s cafés face the sea — Greek, Levantine, and Egyptian café habits layered over a century of port life.',
        'تواجه مقاهي الإسكندرية البحر — عادات قهوة يونانية ومشرقية ومصرية فوق قرن من حياة الميناء.'
      ),
      tags: tags(['Alexandria', 'Sea', 'Café'], ['إسكندرية', 'بحر', 'مقهى']),
      image: '/egypt/assets/hookah/alexandria-cafe.jpg'
    },
    {
      id: 'khan-shisha',
      emoji: '💨',
      siteId: 'khan-el-khalili',
      name: b('Khan shisha', 'شيشة الخان'),
      tagline: b('Water pipe among craft alleys', 'نرجيلة بين أزقة الحِرَف'),
      history: b(
        'Around Khan el-Khalili, shisha follows tea rather than replacing it. Coals pace bargaining and tourist talk alike.',
        'حول خان الخليلي تأتي الشيشة بعد الشاي لا بديلاً عنه. يضبط الجمر المساومة وحديث الزوار معاً.'
      ),
      tags: tags(['Shisha', 'Souq', 'Evening'], ['شيشة', 'سوق', 'مساء']),
      image: '/egypt/assets/hookah/khan-shisha.jpg'
    },
    {
      id: 'aswan-evening',
      emoji: '🌙',
      siteId: 'aswan',
      name: b('Aswan evening', 'مساء أسوان'),
      tagline: b('Felucca dusk and slow southern cups', 'غروب الفلكة وفناجين الجنوب البطيئة'),
      history: b(
        'Aswan evenings mix Nubian hospitality with river cafés. Tea and talk stretch after the desert heat drops.',
        'يمزج مساء أسوان الضيافة النوبية بمقاهي النهر. يمتد الشاي والحديث بعد انخفاض حر الصحراء.'
      ),
      tags: tags(['Aswan', 'Nubian', 'River'], ['أسوان', 'نوبي', 'نهر']),
      image: '/egypt/assets/hookah/aswan-evening.jpg'
    }
  ],
  living: [
    {
      id: 'nile-flood-memory',
      emoji: '🌊',
      siteId: 'fayoum',
      name: b('Nile flood memory', 'ذاكرة فيضان النيل'),
      tagline: b('Season that once organized the year', 'الموسم الذي نظّم السنة يوماً'),
      history: b(
        'Before the High Dam, the annual flood renewed fields and calendars. Songs, proverbs, and irrigation habits still remember that rhythm.',
        'قبل السد العالي جدّد الفيضان السنوي الحقول والتقويم. ما زالت الأغاني والأمثال وعادات الري تتذكّر ذلك الإيقاع.'
      ),
      tags: tags(['Nile', 'Agriculture', 'Memory'], ['نيل', 'زراعة', 'ذاكرة']),
      image: '/egypt/assets/living/nile-flood-memory.jpg'
    },
    {
      id: 'calligraphy',
      emoji: '✒️',
      siteId: 'islamic-cairo',
      name: b('Arabic calligraphy', 'الخط العربي'),
      tagline: b('Script as living craft in Cairo', 'الخط كحرفة حية في القاهرة'),
      history: b(
        'Calligraphers carry mosque bands, shop signs, and school copybooks. In Historic Cairo the pen remains a public art.',
        'يحمل الخطاطون أشرطة المساجد ولافتات الدكاكين وكراسات المدارس. في القاهرة التاريخية يبقى القلم فناً عاماً.'
      ),
      tags: tags(['Script', 'Art', 'Cairo'], ['خط', 'فن', 'قاهرة']),
      image: '/egypt/assets/living/calligraphy.jpg'
    },
    {
      id: 'souq',
      emoji: '🏪',
      siteId: 'khan-el-khalili',
      name: b('Souq life', 'حياة السوق'),
      tagline: b('Covered markets of spice and copper', 'أسواق مسقوفة للتوابل والنحاس'),
      history: b(
        'From Khan el-Khalili to provincial souqs, markets organize scent, bargaining, and neighborhood news. Trade streets are Egypt’s oldest social media.',
        'من خان الخليلي إلى أسواق المحافظات تنظّم الأسواق الرائحة والمساومة وأخبار الحي. شوارع التجارة أقدم وسائل تواصل مصر.'
      ),
      tags: tags(['Market', 'Trade', 'City'], ['سوق', 'تجارة', 'مدينة']),
      image: '/egypt/assets/living/souq.jpg'
    },
    {
      id: 'felucca',
      emoji: '⛵',
      siteId: 'aswan',
      name: b('Felucca', 'فلكة'),
      tagline: b('Lateen sail on the Nile', 'شراع مثلثي على النيل'),
      history: b(
        'Wooden feluccas still catch wind between Aswan and Luxor. The boat is transport, livelihood, and a slow way to see the river.',
        'ما زالت الفلكات الخشبية تلتقط الريح بين أسوان والأقصر. القارب نقل ورزق وطريقة بطيئة لرؤية النهر.'
      ),
      tags: tags(['Boat', 'Nile', 'Sail'], ['قارب', 'نيل', 'شراع']),
      image: '/egypt/assets/living/felucca.jpg'
    },
    {
      id: 'coptic-community',
      emoji: '⛪',
      siteId: 'cairo',
      name: b('Coptic community', 'المجتمع القبطي'),
      tagline: b('Ancient Christian Egypt still living', 'مصر المسيحية القديمة ما زالت حيّة'),
      history: b(
        'Copts are among the world’s oldest Christian communities. Churches, monasteries, and feast calendars remain woven into Egyptian cities and villages.',
        'الأقباط من أقدم الجماعات المسيحية في العالم. تبقى الكنائس والأديرة وتقويمات الأعياد منسوجة في مدن مصر وقراها.'
      ),
      tags: tags(['Coptic', 'Faith', 'Heritage'], ['قبطي', 'إيمان', 'تراث']),
      image: '/egypt/assets/living/coptic-community.jpg'
    },
    {
      id: 'bedouin-sinai',
      emoji: '🏕️',
      siteId: 'st-catherine',
      name: b('Bedouin Sinai', 'بدو سيناء'),
      tagline: b('Desert hospitality and mountain paths', 'ضيافة الصحراء ودروب الجبل'),
      history: b(
        'Sinai Bedouin communities guide pilgrims and travelers across desert and mountain. Tea, tents, and trail knowledge organize southern Sinai life.',
        'ترشد جماعات بدو سيناء الحجّاج والمسافرين عبر الصحراء والجبل. ينظّم الشاي والخيام ومعرفة الدروب حياة جنوب سيناء.'
      ),
      tags: tags(['Bedouin', 'Sinai', 'Hospitality'], ['بدو', 'سيناء', 'ضيافة']),
      image: '/egypt/assets/living/bedouin-sinai.jpg'
    },
    {
      id: 'cafe-culture',
      emoji: '🗞️',
      siteId: 'cairo',
      name: b('Café culture', 'ثقافة المقهى'),
      tagline: b('Ahwa as Egypt’s living room', 'القهوة كصالة مصر'),
      history: b(
        'Ahwa tables host politics, poetry, football arguments, and quiet chess. The café is where the city thinks out loud.',
        'تستضيف طاولات القهوة السياسة والشعر وجدال الكرة والشطرنج الهادئ. المقهى حيث تفكّر المدينة بصوت عالٍ.'
      ),
      tags: tags(['Café', 'Talk', 'City'], ['مقهى', 'حديث', 'مدينة']),
      image: '/egypt/assets/living/cafe-culture.jpg'
    },
    {
      id: 'craft-khan',
      emoji: '🔨',
      siteId: 'khan-el-khalili',
      name: b('Craft of the Khan', 'حِرَف الخان'),
      tagline: b('Copper, perfume, and handmade work', 'نحاس وعطور وعمل يدوي'),
      history: b(
        'Metalworkers, perfume mixers, and inlay artisans keep Khan el-Khalili a workshop as much as a market. Craft skill is tourism and inheritance at once.',
        'يُبقي النحّاسون وعطّارو العطور وصنّاع التطعيم خان الخليلي ورشة بقدر ما هو سوق. المهارة الحرفية سياحة وإرث معاً.'
      ),
      tags: tags(['Craft', 'Souq', 'Handmade'], ['حرفة', 'سوق', 'يدوي']),
      image: '/egypt/assets/living/craft-khan.jpg'
    }
  ],
  phrases: [
    { ar: 'أهلاً وسهلاً', translit: 'Ahlan wa sahlan', en: 'Welcome / hello' },
    { ar: 'إزيك؟', translit: 'Izzayyak?', en: 'How are you? (to a man)' },
    { ar: 'إزيكِ؟', translit: 'Izzayyik?', en: 'How are you? (to a woman)' },
    { ar: 'كويس', translit: 'Kuwayyis', en: 'Good / fine' },
    { ar: 'الحمد لله', translit: 'Alhamdulillah', en: 'Praise God / I am well' },
    { ar: 'تشرفنا', translit: 'Tasharrafna', en: 'Pleased to meet you' },
    { ar: 'من فضلك', translit: 'Min fadlak', en: 'Please' },
    { ar: 'شكراً', translit: 'Shukran', en: 'Thank you' },
    { ar: 'عفواً', translit: 'ʿAfwan', en: 'You’re welcome / excuse me' },
    { ar: 'مع السلامة', translit: 'Maʿa salama', en: 'Goodbye' },
    { ar: 'يا مرحب', translit: 'Ya marhab', en: 'Welcome (warm)' },
    { ar: 'تمام', translit: 'Tamām', en: 'All good / OK' },
    { ar: 'ماشي', translit: 'Mashi', en: 'OK / alright (colloquial)' },
    { ar: 'اتفضل', translit: 'Itfaddal', en: 'Please go ahead / help yourself' },
    { ar: 'صباح الخير', translit: 'Ṣabāḥ el-kheer', en: 'Good morning' },
    { ar: 'مساء الخير', translit: 'Masāʾ el-kheer', en: 'Good evening' }
  ]
};

assertUiKeys(content.ui);

const reel = {
  id: 'egypt-hyperframes-reel',
  title: b('Egypt HyperFrame Tour', 'جولة مصر المصوّرة'),
  portrait: '/egypt/assets/omar-guide-portrait-256.png',
  voice: { en: 'en-US-Neural2-D', ar: 'ar-XA-Wavenet-B' },
  pitch: -1,
  speakingRate: 0.98,
  scenes: [
    {
      id: 'welcome',
      anchor: 'egHero',
      spotlight: '#egHero',
      durationMs: 7200,
      kicker: b('Welcome', 'أهلاً'),
      title: b('Ahlan — Egypt', 'أهلاً — مصر'),
      copy: b('I am Omar. Nile, stone, and living tables — told with care.', 'أنا عمر. نيل وحجر ومائدة حية — تُروى بعناية.'),
      narration: b(
        'Ahlan wa sahlan. I am Omar. This atlas is Egypt — pyramids and temples, Fatimid Cairo, Nile light, and a living table of koshari and song. Give me a few minutes and I will walk you through the map, the eras, and the flavors.',
        'أهلاً وسهلاً. أنا عمر. هذا الأطلس مصر — أهرام ومعابد، والقاهرة الفاطمية، وضوء النيل، ومائدة حية من الكشري والغناء. أعطني دقائق وأمشيك عبر الخريطة والعصور والنكهات.'
      )
    },
    {
      id: 'atlas',
      anchor: 'egMap',
      spotlight: '#egMap',
      action: 'openAtlas',
      durationMs: 7000,
      kicker: b('Atlas', 'أطلس'),
      title: b('The map opens', 'تُفتح الخريطة'),
      copy: b('Nile bends, desert edge, Red Sea — every pin a place.', 'انحناءات النيل وحافة الصحراء والبحر الأحمر — كل علامة مكان.'),
      narration: b(
        'First, the atlas. From Cairo to Aswan, from Giza’s plateau to Luxor’s temples — history pins, food towns, and living places. Select a name and the map leans in.',
        'أولاً الأطلس. من القاهرة إلى أسوان، من هضبة الجيزة إلى معابد الأقصر — علامات تاريخ وبلدات طعام وأماكن حيّة. اختر اسماً فتميل الخريطة نحوه.'
      )
    },
    {
      id: 'cairo',
      anchor: 'egMap',
      spotlight: '#egMapCanvas',
      action: 'focusCairo',
      durationMs: 8200,
      kicker: b('Capital', 'العاصمة'),
      title: b('Cairo', 'القاهرة'),
      copy: b('Nile capital of mosques, film, and ahwa talk.', 'عاصمة النيل للمساجد والسينما وحديث القهوة.'),
      narration: b(
        'Start in Cairo. Fatimid and Mamluk streets still hold Al-Azhar; today the megacity sings, films, and pours shai from dawn to late night.',
        'نبدأ من القاهرة. ما زالت شوارع فاطمية ومملوكية تحمل الأزهر؛ واليوم تغني المدينة العملاقة وتصوّر وتصب الشاي من الفجر إلى الليل المتأخر.'
      )
    },
    {
      id: 'giza',
      anchor: 'egMap',
      spotlight: '#egMapCanvas',
      action: 'focusGiza',
      durationMs: 8000,
      kicker: b('Pyramids', 'أهرام'),
      title: b('Giza', 'الجيزة'),
      copy: b('Eternal stone on the desert edge.', 'حجر خالد على حافة الصحراء.'),
      narration: b(
        'Then Giza — the Great Pyramid, its companions, and the Sphinx. Old Kingdom kings built mountains of stone so the horizon would remember them.',
        'ثم الجيزة — الهرم الأكبر ورفقاؤه وأبو الهول. بنى ملوك الدولة القديمة جبالاً من حجر حتى يتذكّرهم الأفق.'
      )
    },
    {
      id: 'luxor',
      anchor: 'egMap',
      spotlight: '#egMapCanvas',
      action: 'focusLuxor',
      durationMs: 8000,
      kicker: b('Thebes', 'طيبة'),
      title: b('Luxor', 'الأقصر'),
      copy: b('Temples on both banks of the Nile.', 'معابد على ضفتي النيل.'),
      narration: b(
        'South to Luxor — ancient Thebes. Karnak’s pylons, Luxor Temple, and the Valley of the Kings still hold New Kingdom glory in stone and painted tombs.',
        'جنوباً إلى الأقصر — طيبة القديمة. ما زالت أبراج الكرنك ومعبد الأقصر ووادي الملوك تحمل مجد الدولة الحديثة في الحجر والمقابر الملونة.'
      )
    },
    {
      id: 'alexandria',
      anchor: 'egMap',
      spotlight: '#egMapCanvas',
      action: 'focusAlexandria',
      durationMs: 7800,
      kicker: b('Sea', 'بحر'),
      title: b('Alexandria', 'الإسكندرية'),
      copy: b('Mediterranean wind and Ptolemaic memory.', 'ريح المتوسط وذاكرة بطلمية.'),
      narration: b(
        'North to Alexandria. Ptolemaic capital of libraries and lighthouse legend — today a corniche city where the sea still sets the mood.',
        'شمالاً إلى الإسكندرية. عاصمة بطلمية للمكتبات وأسطورة المنارة — اليوم مدينة كورنيش ما زال البحر يضبط مزاجها.'
      )
    },
    {
      id: 'eras',
      anchor: 'egTimeline',
      spotlight: '#egTimeline',
      action: 'openFirstEra',
      durationMs: 7500,
      kicker: b('Timeline', 'خط زمني'),
      title: b('Eras of Egypt', 'عصور مصر'),
      copy: b('Predynastic to today — select a layer to hear it.', 'من ما قبل الأسرات إلى اليوم — اختر طبقة لتسمعها.'),
      narration: b(
        'Open the timeline. Predynastic kingdoms, Old Kingdom pyramids, New Kingdom temples, Ptolemaic Alexandria, Roman and Islamic Cairo, Mamluks, Ottomans, Muhammad Ali, and the contemporary republic — each layer has a place on the map.',
        'افتح الخط الزمني. ممالك ما قبل الأسرات وأهرام الدولة القديمة ومعابد الدولة الحديثة وإسكندرية البطالمة والقاهرة الرومانية والإسلامية والمماليك والعثمانيون ومحمد علي والجمهورية المعاصرة — لكل طبقة مكان على الخريطة.'
      )
    },
    {
      id: 'food',
      anchor: 'egFood',
      spotlight: '#egFoodGrid',
      action: 'flipFirstFood',
      durationMs: 7200,
      kicker: b('Table', 'مائدة'),
      title: b('Koshari and ful', 'كشري وفول'),
      copy: b('Flip a plate — street bowls, mahshi trays, and konafa.', 'اقلب طبقاً — أطباق شارع وصواني محشي وكنافة.'),
      narration: b(
        'At the table, koshari stacks the street bowl, ful steams at dawn, and konafa sweetens the night. Flip a card and I will tell you why patience tastes like hospitality here.',
        'على المائدة يرصّ الكشري طبق الشارع، ويبخّر الفول عند الفجر، وتحلّي الكنافة الليل. اقلب بطاقة وأخبرك لماذا يذوق الصبر كضيافة هنا.'
      )
    },
    {
      id: 'music',
      anchor: 'egMusic',
      spotlight: '#egMusicGrid',
      action: 'flipFirstMusic',
      durationMs: 7000,
      kicker: b('Sound', 'صوت'),
      title: b('Umm Kulthum and tarab', 'أم كلثوم والطرب'),
      copy: b('Cairo suites, Saʿidi folk, and Nile song.', 'متتاليات القاهرة وشعبي الصعيد وأغنية النيل.'),
      narration: b(
        'Listen for Umm Kulthum, Egyptian oud, tabla rhythms, Saʿidi folk, classical tarab, and new Cairo nights. Flip a music card for the history behind the mode.',
        'اسمع أم كلثوم والعود المصري وإيقاعات الطبلة والشعبي الصعيدي والطرب الكلاسيكي وليالي القاهرة الجديدة. اقلب بطاقة موسيقى لتقرأ الحكاية خلف المقام.'
      )
    },
    {
      id: 'majlis',
      anchor: 'egHookah',
      spotlight: '#egHookahGrid',
      action: 'flipFirstHookah',
      durationMs: 6800,
      kicker: b('Café', 'مقهى'),
      title: b('Tea before smoke', 'شاي قبل الدخان'),
      copy: b('Ahwa talk — then slow shisha.', 'حديث القهوة — ثم شيشة بطيئة.'),
      narration: b(
        'In the café, shai comes first. Newspapers, backgammon, and Nile terraces still outlast the coals.',
        'في المقهى يأتي الشاي أولاً. ما زالت الصحف والطاولة وشرفات النيل أطول عمراً من الجمر.'
      )
    },
    {
      id: 'living',
      anchor: 'egLiving',
      spotlight: '#egLivingGrid',
      action: 'flipFirstLiving',
      durationMs: 7200,
      kicker: b('Living', 'حياة'),
      title: b('Nile and souq', 'نيل وسوق'),
      copy: b('Flood memory, feluccas, Coptic feasts, and Sinai paths.', 'ذاكرة فيضان وفلكات وأعياد قبطية ودروب سيناء.'),
      narration: b(
        'Living culture is Nile flood memory, calligraphy, souq bargaining, felucca sails, Coptic communities, and Bedouin Sinai hospitality. These are not museum labels — they still organize the year.',
        'الثقافة الحيّة هي ذاكرة فيضان النيل والخط ومساومة السوق وأشرعة الفلكة والأقباط وضيافة بدو سيناء. هذه ليست بطاقات متحف — ما زالت تنظّم السنة.'
      )
    },
    {
      id: 'phrases',
      anchor: 'egPhrases',
      spotlight: '#egPhraseList',
      action: 'speakFirstPhrase',
      durationMs: 6500,
      kicker: b('Speak', 'تكلّم'),
      title: b('Ahlan wa sahlan', 'أهلاً وسهلاً'),
      copy: b('Press a phrase — I will say it aloud.', 'اضغط عبارة — سأقولها بصوت عالٍ.'),
      narration: b(
        'Before you go, take an Egyptian greeting. Izzayyak? Press any phrase on the page and I will say it for you in everyday Egyptian Arabic.',
        'قبل أن تمضي، خذ تحية مصرية. إزيك؟ اضغط أي عبارة في الصفحة وسأقولها لك بعربية مصرية يومية.'
      )
    },
    {
      id: 'close',
      anchor: 'egGuide',
      spotlight: '#egGuide',
      action: 'unflipCards',
      durationMs: 7000,
      kicker: b('Ask me', 'اسألني'),
      title: b('I am still here', 'ما زلت هنا'),
      copy: b('Ask Omar about Giza, koshari, or Umm Kulthum.', 'اسأل عمر عن الجيزة أو الكشري أو أم كلثوم.'),
      narration: b(
        'That is the tour. Stay on the map, flip more cards, or ask me anything — Giza’s stones, Luxor’s temples, koshari bowls, or the voice of Umm Kulthum. Maʿa salama for now, and welcome whenever you return.',
        'هذه هي الجولة. ابقَ على الخريطة، أو اقلب مزيداً من البطاقات، أو اسألني أي شيء — حجارة الجيزة، ومعابد الأقصر، وأطباق الكشري، أو صوت أم كلثوم. مع السلامة الآن، وأهلاً بك كلما عدت.'
      )
    }
  ]
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, 'egypt-content.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8');
writeFileSync(path.join(OUT_DIR, 'egypt-story-reel.json'), `${JSON.stringify(reel, null, 2)}\n`, 'utf8');
console.log(
  `Wrote Egypt content: eras=${content.eras.length} sites=${content.sites.length} foods=${content.foods.length} music=${content.music.length} hookah=${content.hookah.length} living=${content.living.length} phrases=${content.phrases.length} scenes=${reel.scenes.length}`
);
