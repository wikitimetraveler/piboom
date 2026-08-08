#!/usr/bin/env node
/**
 * Write full bilingual Iraq atlas content + story reel JSON.
 *   node scripts/tools/write-iraq-content.mjs
 * Development work by David Lane
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public/iraq/data');

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
  id: 'iraq-atlas',
  brand: {
    name: b('Iraq — Land Between the Rivers', 'العراق — بلاد ما بين النهرين'),
    tagline: b(
      'From Sumer and Babylon to Baghdad’s books — history, table, and song between Tigris and Euphrates.',
      'من سومر وبابل إلى كتب بغداد — تاريخ ومائدة وغناء بين دجلة والفرات.'
    )
  },
  guide: {
    name: b('Zayd', 'زيد'),
    title: b('Iraq history guide', 'دليل تاريخ العراق'),
    portrait: '/iraq/assets/zayd-guide-portrait-256.png',
    greeting: b(
      'Ahlan wa sahlan. I am Zayd — walk with me from Baghdad to Babylon and Ur.',
      'أهلاً وسهلاً. أنا زيد — امشِ معي من بغداد إلى بابل وأور.'
    )
  },
  ui: {
    en: {
      dir: 'ltr',
      langLabel: 'English',
      switchTo: 'عربي',
      heroKicker: 'Mesopotamia',
      heroTitle: 'Iraq',
      heroLine:
        'A river civilization between Tigris and Euphrates — Sumerian cities, Abbasid books, marsh light, and a living table of masgouf, quzi, and maqam.',
      playReel: 'Play HyperFrame tour',
      pauseReel: 'Pause tour',
      resumeReel: 'Resume tour',
      stopReel: 'Stop tour',
      narration: 'Narration',
      narrationScope: 'Entire page — atlas, tour, and cards',
      hearWelcome: 'Hear welcome',
      askGuide: 'Ask Zayd',
      stop: 'Stop',
      listen: 'Listen',
      exploreMap: 'Explore the atlas',
      timelineHeading: 'Eras of Iraq',
      timelineLead:
        'From Sumer to contemporary Iraq. Select an era to hear it and find it on the map.',
      timelineSelectHint: 'Select an era on the timeline',
      mapHeading: 'Atlas of Iraq',
      mapLead: 'Rivers, marshes, and desert edge. Select a pin or a name to hear its story.',
      mapAll: 'All',
      mapHistory: 'History',
      mapFood: 'Food',
      mapMusic: 'Music',
      mapHookah: 'Café',
      mapLiving: 'Living',
      mapReset: 'Show all pins',
      mapLoading: 'Loading the atlas…',
      foodHeading: 'The Iraqi table',
      foodLead: 'Masgouf, quzi, dolma, and kleicha — flip a dish for its origin and meaning.',
      musicHeading: 'Sound of Iraq',
      musicLead: 'Iraqi maqam, oud of Baghdad, and chalghi ensembles. Flip a card for the history.',
      hookahHeading: 'Café — tea and slow talk',
      hookahLead: 'Chai, nargileh, and evening conversation — the Iraqi café as social furniture.',
      livingHeading: 'Living cultures',
      livingLead: 'Ashura processions, marsh life, calligraphy, bazaars, and Nowruz in the north.',
      phraseHeading: 'Speak Iraqi',
      phraseLead: 'Everyday Arabic greetings heard across Iraq. Press any phrase to hear it.',
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
      meetGuide: 'Meet Zayd'
    },
    ar: {
      dir: 'rtl',
      langLabel: 'العربية',
      switchTo: 'English',
      heroKicker: 'بلاد الرافدين',
      heroTitle: 'العراق',
      heroLine:
        'حضارة نهرية بين دجلة والفرات — مدن سومر، وكتب بغداد، وضوء الأهوار، ومائدة حية من المسگوف والقوزي والمقام.',
      playReel: 'شغّل الجولة',
      pauseReel: 'إيقاف مؤقت',
      resumeReel: 'متابعة الجولة',
      stopReel: 'إنهاء الجولة',
      narration: 'السرد الصوتي',
      narrationScope: 'الصفحة كاملة — الأطلس والجولة والبطاقات',
      hearWelcome: 'استمع للترحيب',
      askGuide: 'اسأل زيد',
      stop: 'إيقاف',
      listen: 'استمع',
      exploreMap: 'استكشف الأطلس',
      timelineHeading: 'عصور العراق',
      timelineLead: 'من سومر إلى العراق المعاصر. اختر حقبة لتسمعها وتجدها على الخريطة.',
      timelineSelectHint: 'اختر حقبة من الخط الزمني',
      mapHeading: 'أطلس العراق',
      mapLead: 'أنهار وأهوار وحافة صحراء. اختر علامة أو اسماً لتسمع حكايته.',
      mapAll: 'الكل',
      mapHistory: 'تاريخ',
      mapFood: 'طعام',
      mapMusic: 'موسيقى',
      mapHookah: 'مقهى',
      mapLiving: 'حياة',
      mapReset: 'أظهر كل العلامات',
      mapLoading: 'جارٍ تحميل الأطلس…',
      foodHeading: 'المائدة العراقية',
      foodLead: 'مسگوف وقوزي ودولمة وكليجة — اقلب الطبق لتعرف أصله ومعناه.',
      musicHeading: 'صوت العراق',
      musicLead: 'المقام العراقي وعود بغداد وجلسات الجلغي. اقلب البطاقة لتقرأ الحكاية.',
      hookahHeading: 'المقهى — شاي وحديث بطيء',
      hookahLead: 'شاي ونرجيلة وحديث المساء — المقهى العراقي كأثاث اجتماعي.',
      livingHeading: 'ثقافات حيّة',
      livingLead: 'مواكب عاشوراء وحياة الأهوار والخط والأسواق ونوروز الشمال.',
      phraseHeading: 'احكِ عراقي',
      phraseLead: 'تحيات عربية يومية تُسمَع في العراق. اضغط أي عبارة لتسمعها.',
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
      meetGuide: 'تعرّف على زيد'
    }
  },
  eras: [
    {
      id: 'sumer',
      siteId: 'ur',
      yearCE: -3000,
      years: b('c. 3500–2000 BCE', 'نحو ٣٥٠٠–٢٠٠٠ ق.م'),
      title: b('Sumer — first cities', 'سومر — المدن الأولى'),
      copy: b('Uruk, Ur, and cuneiform invent urban life.', 'أوروك وأور والمسمارية تخترع الحياة الحضرية.'),
      narration: b(
        'We begin in Sumer. Between the rivers, cities raised ziggurats, wrote on clay, and traded across the Gulf long before later empires borrowed their script.',
        'نبدأ بسومر. بين النهرين رفعت المدن الزقورات وكتبت على الطين وتاجرت عبر الخليج قبل أن تستعير الإمبراطوريات اللاحقة خطّها بزمن طويل.'
      ),
      history: b(
        'Sumerian city-states such as Uruk, Ur, and Lagash developed irrigation, temples, and the earliest known writing. Royal tombs at Ur and temple economies show how religion and surplus organized the first urban south of Mesopotamia.',
        'طوّرت دويلات المدن السومرية مثل أوروك وأور ولجش الريّ والمعابد وأقدم كتابة معروفة. وتُظهر مقابر أور الملكية واقتصاد المعبد كيف نظّم الدين والفائض جنوب بلاد الرافدين الحضري الأول.'
      ),
      image: '/iraq/assets/era/sumer.jpg'
    },
    {
      id: 'babylon',
      siteId: 'babylon',
      yearCE: -1750,
      years: b('c. 1894–539 BCE', 'نحو ١٨٩٤–٥٣٩ ق.م'),
      title: b('Babylon', 'بابل'),
      copy: b('Hammurabi’s law and Nebuchadnezzar’s city.', 'شريعة حمورابي ومدينة نبوخذ نصر.'),
      narration: b(
        'Next, Babylon. Hammurabi’s stele spoke of justice; later Nebuchadnezzar rebuilt walls and processional ways that made the city a wonder of the ancient world.',
        'ثم بابل. تكلّم مسلة حمورابي عن العدل؛ ثم أعاد نبوخذ نصر بناء الأسوار وطرق المواكب التي جعلت المدينة أعجوبة العالم القديم.'
      ),
      history: b(
        'Old Babylonian and Neo-Babylonian periods made Babylon a political and cultural capital. Law, astronomy, and monumental architecture framed Mesopotamian kingship until the Persian conquest of 539 BCE.',
        'جعلت الفترات البابلية القديمة والحديثة بابل عاصمة سياسية وثقافية. شكّل القانون والفلك والعمارة الضخمة الملوكية الرافدينية حتى الفتح الفارسي سنة ٥٣٩ ق.م.'
      ),
      image: '/iraq/assets/era/babylon.jpg'
    },
    {
      id: 'assyria',
      siteId: 'mosul',
      yearCE: -700,
      years: b('c. 900–609 BCE', 'نحو ٩٠٠–٦٠٩ ق.م'),
      title: b('Assyria', 'آشور'),
      copy: b('Nineveh’s libraries and northern power.', 'مكتبات نينوى وقوة الشمال.'),
      narration: b(
        'Assyria ruled from Assur, Kalhu, and Nineveh. Reliefs of lion hunts and Ashurbanipal’s library made the north a capital of empire and clay books.',
        'حكمت آشور من آشور وكالح ونينوى. جعلت نقوش صيد الأسود ومكتبة آشوربانيبال الشمال عاصمة إمبراطورية وكتب طين.'
      ),
      history: b(
        'Neo-Assyrian kings built an imperial machine of roads, deportations, and provincial governors. Excavations near Mosul recovered palace reliefs and tens of thousands of tablets — including literary classics copied in Akkadian.',
        'بنى ملوك آشور الحديثة آلة إمبراطورية من طرق وترحيل وحكام ولايات. واستعادت حفريات قرب الموصل نقوش القصور وعشرات آلاف الألواح — بما فيها كلاسيكيات أدبية منسوخة بالأكدية.'
      ),
      image: '/iraq/assets/era/assyria.jpg'
    },
    {
      id: 'abbasid',
      siteId: 'baghdad',
      yearCE: 800,
      years: b('750–1258 CE', '٧٥٠–١٢٥٨ م'),
      title: b('Abbasid Baghdad', 'بغداد العباسية'),
      copy: b('Round city, House of Wisdom, and poetry.', 'مدينة مدوّرة وبيت الحكمة وشعر.'),
      narration: b(
        'The Abbasids founded Baghdad as a round capital. Scholars translated Greek and Persian sciences; markets and mosques made the city the heartbeat of a vast caliphate.',
        'أسّس العباسيون بغداد عاصمة مدوّرة. ترجم العلماء علوم اليونان وفارس؛ وجعلت الأسواق والمساجد المدينة نبض خلافة واسعة.'
      ),
      history: b(
        'From al-Mansur’s foundation through Harun al-Rashid and al-Maʾmun, Baghdad was a world city of learning and trade. The Mongol sack of 1258 devastated the capital, but Iraqi urban and literary culture continued under later dynasties.',
        'من تأسيس المنصور عبر هارون الرشيد والمأمون كانت بغداد مدينة عالم للعلم والتجارة. دمّر اجتياح المغول سنة ١٢٥٨ العاصمة، لكن الثقافة الحضرية والأدبية العراقية استمرت تحت أسر لاحقة.'
      ),
      image: '/iraq/assets/era/abbasid.jpg'
    },
    {
      id: 'ottoman',
      siteId: 'baghdad',
      yearCE: 1534,
      years: b('16th–early 20th c.', 'القرن ١٦ – أوائل ٢٠'),
      title: b('Ottoman Iraq', 'العراق العثماني'),
      copy: b('Provinces of Baghdad, Mosul, and Basra.', 'ولايات بغداد والموصل والبصرة.'),
      narration: b(
        'Ottoman rule organized Iraq as provinces facing Iran and the Gulf. Caravan trade, shrine cities, and tribal politics shaped centuries of layered authority.',
        'نظّم الحكم العثماني العراق ولايات تواجه إيران والخليج. شكّلت تجارة القوافل ومدن المقامات والسياسة القبلية قروناً من سلطة متعددة الطبقات.'
      ),
      history: b(
        'After the Ottoman conquest, Baghdad, Mosul, and Basra were key eyalets. Mamluk governors in Baghdad, Wahhabi raids, and nineteenth-century reforms remade administration before World War I ended Ottoman control.',
        'بعد الفتح العثماني كانت بغداد والموصل والبصرة إيالات مفتاحية. أعاد حكّام المماليك في بغداد وغزوات الوهابيين وإصلاحات القرن التاسع عشر صياغة الإدارة قبل أن تنهي الحرب العالمية الأولى السيطرة العثمانية.'
      ),
      image: '/iraq/assets/era/ottoman.jpg'
    },
    {
      id: 'mandate-kingdom',
      siteId: 'baghdad',
      yearCE: 1921,
      years: b('1920–1958', '١٩٢٠–١٩٥٨'),
      title: b('Mandate and Hashemite kingdom', 'الانتداب والمملكة الهاشمية'),
      copy: b('British mandate, then a modern monarchy.', 'انتداب بريطاني ثم ملكية حديثة.'),
      narration: b(
        'After World War I, a British mandate and then the Hashemite kingdom forged a modern Iraqi state — oil, parliament, and restless politics between Baghdad and the provinces.',
        'بعد الحرب العالمية الأولى صنع انتداب بريطاني ثم المملكة الهاشمية دولة عراقية حديثة — نفط وبرلمان وسياسة قلقة بين بغداد والولايات.'
      ),
      history: b(
        'The 1920 revolt, Faisal I’s coronation, and the 1932 independence marked state formation. Oil at Kirkuk and Basra funded development while coups and social movements pressed the monarchy until 1958.',
        'علّمت ثورة ١٩٢٠ وتتويج فيصل الأول واستقلال ١٩٣٢ تشكّل الدولة. موّل نفط كركوك والبصرة التنمية بينما ضغطت الانقلابات والحركات الاجتماعية على الملكية حتى ١٩٥٨.'
      ),
      image: '/iraq/assets/era/mandate-kingdom.jpg'
    },
    {
      id: 'republic',
      siteId: 'baghdad',
      yearCE: 1958,
      years: b('1958–2003', '١٩٥٨–٢٠٠٣'),
      title: b('Republic and Baʿath decades', 'الجمهورية وعقود البعث'),
      copy: b('Coups, oil wealth, war, and dictatorship.', 'انقلابات وثروة نفط وحرب وديكتاتورية.'),
      narration: b(
        'The 1958 republic opened a turbulent half-century — Arab nationalism, Baʿath rule, the Iran–Iraq War, and the 1990s sanctions that reshaped daily life.',
        'فتحت جمهورية ١٩٥٨ نصف قرن مضطرب — قومية عربية وحكم بعث وحرب إيران والعراق وعقوبات التسعينيات التي أعادت صياغة الحياة اليومية.'
      ),
      history: b(
        'From Qasim’s republic through Baʿath consolidation under Saddam Hussein, Iraq experienced land reform, oil nationalization, devastating wars, and harsh authoritarianism. The 2003 US-led invasion ended that regime.',
        'من جمهورية قاسم عبر توطيد البعث تحت صدام حسين شهد العراق إصلاح أراضٍ وتأميم نفط وحروباً مدمّرة وتسلّطاً قاسياً. أنهى الغزو الأميركي بقيادة ٢٠٠٣ ذلك النظام.'
      ),
      image: '/iraq/assets/era/republic.jpg'
    },
    {
      id: 'contemporary',
      siteId: 'baghdad',
      yearCE: 2003,
      years: b('2003 – today', '٢٠٠٣ – اليوم'),
      title: b('Contemporary Iraq', 'العراق المعاصر'),
      copy: b('Federal politics, recovery, and living culture.', 'سياسة اتحادية وتعافٍ وثقافة حية.'),
      narration: b(
        'Contemporary Iraq is federal and plural — Kurdistan’s north, shrine cities of the south, Baghdad’s cafés, and marsh communities restoring water and song after hard decades.',
        'العراق المعاصر اتحادي ومتعدد — شمال كردستان ومدن مقامات الجنوب ومقاهي بغداد ومجتمعات الأهوار تستعيد الماء والغناء بعد عقود قاسية.'
      ),
      history: b(
        'Post-2003 Iraq wrote a federal constitution, faced civil conflict and ISIS, and continues reconstruction. Cultural life — maqam, cuisine, pilgrimage, and marsh revival — remains a resilient public face of the country.',
        'كتب عراق ما بعد ٢٠٠٣ دستوراً اتحادياً وواجه صراعاً أهلياً وداعش ويواصل إعادة الإعمار. تبقى الحياة الثقافية — المقام والمطبخ والحج وإحياء الأهوار — وجهاً عاماً صامداً للبلاد.'
      ),
      image: '/iraq/assets/era/contemporary.jpg'
    }
  ],
  sites: [
    {
      id: 'baghdad',
      category: 'history',
      emoji: '🏙️',
      lat: 33.3152,
      lng: 44.3661,
      unesco: false,
      name: b('Baghdad', 'بغداد'),
      place: b('Capital on the Tigris', 'العاصمة على دجلة'),
      blurb: b('Abbasid memory and modern Iraqi heart.', 'ذاكرة عباسية وقلب عراقي حديث.')
    },
    {
      id: 'babylon',
      category: 'history',
      emoji: '🏛️',
      lat: 32.5421,
      lng: 44.4209,
      unesco: true,
      name: b('Babylon', 'بابل'),
      place: b('Babil', 'بابل'),
      blurb: b('Processional ways and Ishtar Gate memory.', 'طرق مواكب وذاكرة بوابة عشتار.')
    },
    {
      id: 'ur',
      category: 'history',
      emoji: '🧱',
      lat: 30.9627,
      lng: 46.1046,
      unesco: true,
      name: b('Ur', 'أور'),
      place: b('Dhi Qar', 'ذي قار'),
      blurb: b('Sumerian ziggurat and royal tombs.', 'زقورة سومرية ومقابر ملكية.')
    },
    {
      id: 'mosul',
      category: 'history',
      emoji: '🕌',
      lat: 36.3489,
      lng: 43.1577,
      unesco: false,
      name: b('Mosul', 'الموصل'),
      place: b('Nineveh plains', 'سهول نينوى'),
      blurb: b('Tigris city beside ancient Nineveh.', 'مدينة دجلة إلى جوار نينوى القديمة.')
    },
    {
      id: 'erbil',
      category: 'living',
      emoji: '🏰',
      lat: 36.1911,
      lng: 44.0093,
      unesco: true,
      name: b('Erbil', 'أربيل'),
      place: b('Kurdistan', 'كردستان'),
      blurb: b('Citadel mound and northern capital energy.', 'تلة القلعة وطاقة عاصمة الشمال.')
    },
    {
      id: 'basra',
      category: 'food',
      emoji: '⚓',
      lat: 30.5081,
      lng: 47.7835,
      unesco: false,
      name: b('Basra', 'البصرة'),
      place: b('Shatt al-Arab', 'شط العرب'),
      blurb: b('Gulf gateway of dates, canals, and fish.', 'بوابة خليج للتمر والقنوات والسمك.')
    },
    {
      id: 'samarra',
      category: 'history',
      emoji: '🌀',
      lat: 34.1959,
      lng: 43.8747,
      unesco: true,
      name: b('Samarra', 'سامراء'),
      place: b('Abbasid north', 'شمال عباسي'),
      blurb: b('Spiral minaret of a short-lived capital.', 'مئذنة لولبية لعاصمة قصيرة العمر.')
    },
    {
      id: 'karbala',
      category: 'living',
      emoji: '🕯️',
      lat: 32.616,
      lng: 44.0243,
      unesco: false,
      name: b('Karbala', 'كربلاء'),
      place: b('Shrine city', 'مدينة مقام'),
      blurb: b('Ashura pilgrimage and Imam Husayn shrine.', 'حج عاشوراء ومقام الإمام الحسين.')
    },
    {
      id: 'najaf',
      category: 'living',
      emoji: '📿',
      lat: 31.999,
      lng: 44.332,
      unesco: false,
      name: b('Najaf', 'النجف'),
      place: b('Shrine city', 'مدينة مقام'),
      blurb: b('Imam Ali shrine and scholarly hawza.', 'مقام الإمام علي والحوزة العلمية.')
    },
    {
      id: 'hatra',
      category: 'history',
      emoji: '🏜️',
      lat: 35.588,
      lng: 42.718,
      unesco: true,
      name: b('Hatra', 'الحضر'),
      place: b('Desert frontier', 'حدود الصحراء'),
      blurb: b('Parthian temple city of the steppe edge.', 'مدينة معابد بارثية على حافة السهوب.')
    },
    {
      id: 'ahwar',
      category: 'living',
      emoji: '🛶',
      lat: 31.05,
      lng: 47.25,
      unesco: true,
      name: b('Ahwar marshes', 'أهوار العراق'),
      place: b('Southern wetlands', 'أراضٍ رطبة جنوبية'),
      blurb: b('Reed houses, water buffalo, and UNESCO wetlands.', 'بيوت قصب وجواميس وأراضٍ رطبة في اليونسكو.')
    },
    {
      id: 'ctesiphon',
      category: 'music',
      emoji: '🏟️',
      lat: 33.0936,
      lng: 44.5808,
      unesco: false,
      name: b('Ctesiphon', 'قطيسفون'),
      place: b('Taq Kasra', 'طاق كسرى'),
      blurb: b('Sasanian arch facing the Tigris plain.', 'قوس ساساني يواجه سهل دجلة.')
    }
  ],
  foods: [
    {
      id: 'masgouf',
      emoji: '🐟',
      siteId: 'baghdad',
      name: b('Masgouf', 'مسگوف'),
      tagline: b('Butterflied carp grilled by the Tigris', 'سمك مشقوق يُشوى على دجلة'),
      history: b(
        'Fresh carp opened flat, seasoned, and slow-grilled upright beside open flame. Baghdad’s river restaurants made masgouf a national emblem of outdoor feasting.',
        'كارب طازج يُفتح مسطحاً ويُتبَّل ويُشوى ببطء منتصباً إلى جوار اللهب. جعلت مطاعم نهر بغداد المسگوف شعاراً وطنياً للولائم في الهواء الطلق.'
      ),
      tags: tags(['Fish', 'Tigris', 'Grill'], ['سمك', 'دجلة', 'شواء']),
      image: '/iraq/assets/food/masgouf.jpg'
    },
    {
      id: 'quzi',
      emoji: '🍖',
      siteId: 'baghdad',
      name: b('Quzi', 'قوزي'),
      tagline: b('Lamb and spiced rice of celebrations', 'لحم ضأن وأرز متبّل للاحتفال'),
      history: b(
        'Whole or large cuts of lamb served over fragrant rice with nuts and raisins. Quzi is wedding and feast food — abundance arranged on one tray.',
        'قطع كبيرة من الضأن تُقدَّم فوق أرز عطر بالمكسرات والزبيب. القوزي طعام أعراس وولائم — وفرة مرتّبة على صينية واحدة.'
      ),
      tags: tags(['Lamb', 'Rice', 'Feast'], ['ضأن', 'أرز', 'عيد']),
      image: '/iraq/assets/food/quzi.jpg'
    },
    {
      id: 'dolma',
      emoji: '🥬',
      siteId: 'mosul',
      name: b('Dolma', 'دولمة'),
      tagline: b('Stuffed vegetables of family tables', 'محاشي خضار لمائدة العائلة'),
      history: b(
        'Grape leaves, onions, tomatoes, and zucchini filled with rice and meat. Iraqi dolma trays are communal labor — many hands, one pot.',
        'ورق عنب وبصل وطماطم وكوسا تُحشى بالأرز واللحم. صواني الدولمة العراقية عمل جماعي — أيدٍ كثيرة وقدر واحدة.'
      ),
      tags: tags(['Stuffed', 'Family', 'Rice'], ['محاشي', 'عائلة', 'أرز']),
      image: '/iraq/assets/food/dolma.jpg'
    },
    {
      id: 'kleicha',
      emoji: '🍪',
      siteId: 'baghdad',
      name: b('Kleicha', 'كليجة'),
      tagline: b('Date-filled cookies of Eid', 'كعك محشو بالتمر للعيد'),
      history: b(
        'Spiced dough wrapped around date paste in molded shapes. Kleicha marks Eid trays and neighbor exchanges — sweetness as social glue.',
        'عجينة متبّلة تُلف حول معجون تمر بأشكال قوالب. تعلّم الكليجة صواني العيد وتبادل الجيران — حلاوة كغراء اجتماعي.'
      ),
      tags: tags(['Sweet', 'Eid', 'Dates'], ['حلوى', 'عيد', 'تمر']),
      image: '/iraq/assets/food/kleicha.jpg'
    },
    {
      id: 'tashreeb',
      emoji: '🍲',
      siteId: 'najaf',
      name: b('Tashreeb', 'تشريب'),
      tagline: b('Bread soaked in rich broth', 'خبز منقوع في مرق غني'),
      history: b(
        'Torn bread absorbs chickpea or meat broth until soft. Tashreeb is humble comfort — pilgrimage cities and home kitchens alike.',
        'يمتص الخبز الممزق مرق الحمص أو اللحم حتى يلين. التشريب راحة متواضعة — مدن الحج ومطابخ البيوت معاً.'
      ),
      tags: tags(['Broth', 'Bread', 'Comfort'], ['مرق', 'خبز', 'راحة']),
      image: '/iraq/assets/food/tashreeb.jpg'
    },
    {
      id: 'samoon',
      emoji: '🥖',
      siteId: 'baghdad',
      name: b('Samoon', 'صمون'),
      tagline: b('Diamond-shaped Iraqi bakery bread', 'خبز عراقي معيني من الفرن'),
      history: b(
        'Crisp outside, soft inside — samoon is the everyday vehicle for kebabs, eggs, and cheese. Bakeries stamp the city’s morning rhythm.',
        'مقرمش من الخارج طري من الداخل — الصمون مركبة يومية للكباب والبيض والجبن. تختم الأفران إيقاع صباح المدينة.'
      ),
      tags: tags(['Bread', 'Bakery', 'Daily'], ['خبز', 'فرن', 'يومي']),
      image: '/iraq/assets/food/samoon.jpg'
    },
    {
      id: 'iraqi-tea',
      emoji: '🍵',
      siteId: 'basra',
      name: b('Iraqi tea', 'الشاي العراقي'),
      tagline: b('Strong sweet chai in slender glasses', 'شاي قوي حلو في كؤوس رفيعة'),
      history: b(
        'Black tea boiled dark, heavily sweetened, poured into istikan glasses. Tea stalls organize gossip, deals, and rest across Iraq.',
        'شاي أسود يُغلى غامقاً ويُحلّى كثيراً ويُصب في كؤوس الاستكان. تنظّم أكشاك الشاي القيل والقال والصفقات والراحة عبر العراق.'
      ),
      tags: tags(['Tea', 'Café', 'Sweet'], ['شاي', 'مقهى', 'حلو']),
      image: '/iraq/assets/food/iraqi-tea.jpg'
    },
    {
      id: 'timman',
      emoji: '🍚',
      siteId: 'basra',
      name: b('Timman', 'تمن'),
      tagline: b('Iraqi rice — often with vermicelli', 'أرز عراقي — غالباً بالشعيرية'),
      history: b(
        'Timman is the rice bed under stews and quzi. Lightly fried vermicelli and oil perfume the grain — the quiet foundation of the Iraqi table.',
        'التمن فراش الأرز تحت اليخنات والقوزي. شعيرية مقليّة خفيفة وزيت يعطّران الحبّة — الأساس الهادئ للمائدة العراقية.'
      ),
      tags: tags(['Rice', 'Daily', 'Tray'], ['أرز', 'يومي', 'صينية']),
      image: '/iraq/assets/food/timman.jpg'
    }
  ],
  music: [
    {
      id: 'iraqi-maqam',
      emoji: '🎶',
      siteId: 'baghdad',
      name: b('Iraqi maqam', 'المقام العراقي'),
      tagline: b('Classical vocal art of Baghdad', 'فن غناء كلاسيكي بغدادي'),
      history: b(
        'Iraqi maqam is a rigorous vocal tradition with suite forms, poetic texts, and instrumental interludes. UNESCO recognizes it as intangible heritage.',
        'المقام العراقي تقليد غنائي صارم بأشكال متتالية ونصوص شعرية وفواصل آلية. تعترف به اليونسكو تراثاً غير مادي.'
      ),
      tags: tags(['Classical', 'UNESCO', 'Voice'], ['كلاسيكي', 'يونسكو', 'صوت']),
      image: '/iraq/assets/music/iraqi-maqam.jpg'
    },
    {
      id: 'oud-baghdad',
      emoji: '🎸',
      siteId: 'baghdad',
      name: b('Baghdad oud', 'عود بغداد'),
      tagline: b('Lute lineage of the capital', 'سلالة العود في العاصمة'),
      history: b(
        'Baghdad’s oud schools shaped Arab lute technique for a century. The instrument bridges maqam suites and modern song.',
        'شكّلت مدارس عود بغداد تقنية العود العربي قرناً. والجهاز يصل متتاليات المقام بالأغنية الحديثة.'
      ),
      tags: tags(['Oud', 'Baghdad', 'Instrument'], ['عود', 'بغداد', 'آلة']),
      image: '/iraq/assets/music/oud-baghdad.jpg'
    },
    {
      id: 'chalghi',
      emoji: '🥁',
      siteId: 'baghdad',
      name: b('Chalghi baghdadi', 'الجلغي البغدادي'),
      tagline: b('Ensemble that carries the maqam', 'فرقة تحمل المقام'),
      history: b(
        'Santur, joza, tabla, and oud form the classic chalghi. The group answers the singer and colors each maqam turn.',
        'يشكّل السنطور والجوزة والطبلة والعود الجلغي الكلاسيكي. تجيب الفرقة المغني وتلوّن كل انعطافة مقام.'
      ),
      tags: tags(['Ensemble', 'Maqam', 'Baghdad'], ['فرقة', 'مقام', 'بغداد']),
      image: '/iraq/assets/music/chalghi.jpg'
    },
    {
      id: 'folk-south',
      emoji: '🛶',
      siteId: 'ahwar',
      name: b('Southern folk song', 'أغنية الجنوب الشعبية'),
      tagline: b('Marsh rhythms and Basra voice', 'إيقاعات الأهوار وصوت البصرة'),
      history: b(
        'Southern Iraq sings work songs, wedding rhythms, and marsh poetry. Reed landscapes taught tempos that travel to city stages.',
        'يغني جنوب العراق أغاني العمل وإيقاعات الأعراس وشعر الأهوار. علّمت مناظر القصب إيقاعات تسافر إلى مسارح المدينة.'
      ),
      tags: tags(['Folk', 'South', 'Marsh'], ['شعبي', 'جنوب', 'أهوار']),
      image: '/iraq/assets/music/folk-south.jpg'
    },
    {
      id: 'kurdish-folk',
      emoji: '🏞️',
      siteId: 'erbil',
      name: b('Kurdish folk', 'أغنية كردية'),
      tagline: b('Mountain dance and ballad of the north', 'رقص جبلي وملحمة الشمال'),
      history: b(
        'Kurdish song and dance in Erbil and beyond keep seasonal festivals and epic memory alive — a northern voice within Iraq’s plurality.',
        'تبقي الأغنية والرقص الكرديان في أربيل وما بعدها مهرجانات المواسم وذاكرة الملحمة حية — صوتاً شمالياً داخل تعدد العراق.'
      ),
      tags: tags(['Kurdish', 'Dance', 'North'], ['كردي', 'رقص', 'شمال']),
      image: '/iraq/assets/music/kurdish-folk.jpg'
    },
    {
      id: 'contemporary',
      emoji: '🎧',
      siteId: 'baghdad',
      name: b('Contemporary Iraqi music', 'موسيقى عراقية معاصرة'),
      tagline: b('Pop, diaspora stages, and new Baghdad nights', 'بوب ومسارح شتات وليالٍ بغدادية جديدة'),
      history: b(
        'From classic mid-century stars to today’s fusion and diaspora artists, Iraqi musicians remix maqam feeling with global forms.',
        'من نجوم منتصف القرن إلى فناني الاندماج والشتات اليوم، يعيد الموسيقيون العراقيون مزج إحساس المقام بأشكال عالمية.'
      ),
      tags: tags(['Pop', 'Fusion', 'Urban'], ['بوب', 'اندماج', 'حضري']),
      image: '/iraq/assets/music/contemporary.jpg'
    }
  ],
  hookah: [
    {
      id: 'baghdad-chai-khana',
      emoji: '☕',
      siteId: 'baghdad',
      name: b('Chai-khana', 'چايخانه'),
      tagline: b('Tea house of talk and newspapers', 'بيت شاي للحديث والصحف'),
      history: b(
        'Baghdad tea houses pour istikan chai for debate, chess, and poetry. The older grammar is sit long and speak carefully.',
        'تصب بيوت شاي بغداد استكان الشاي للنقاش والشطرنج والشعر. القواعد الأقدم: اجلس طويلاً وتكلّم بحذر.'
      ),
      tags: tags(['Tea', 'Baghdad', 'Talk'], ['شاي', 'بغداد', 'حديث']),
      image: '/iraq/assets/hookah/baghdad-chai-khana.jpg'
    },
    {
      id: 'nargileh-evening',
      emoji: '💨',
      siteId: 'basra',
      name: b('Evening nargileh', 'نرجيلة المساء'),
      tagline: b('Water pipe after strong tea', 'نرجيلة بعد شاي قوي'),
      history: b(
        'In many cafés, nargileh follows tea rather than replacing it. Coals pace the conversation along Gulf and river nights.',
        'في مقاهٍ كثيرة تأتي النرجيلة بعد الشاي لا بديلاً عنه. يضبط الجمر الحديث على ليالي الخليج والنهر.'
      ),
      tags: tags(['Nargileh', 'Café', 'Evening'], ['نرجيلة', 'مقهى', 'مساء']),
      image: '/iraq/assets/hookah/nargileh-evening.jpg'
    },
    {
      id: 'erbil-cafe',
      emoji: '🌙',
      siteId: 'erbil',
      name: b('Erbil evening café', 'مقهى مساء أربيل'),
      tagline: b('Citadel views and slow cups', 'إطلالات القلعة وفناجين بطيئة'),
      history: b(
        'Erbil’s cafés mix Kurdish and Iraqi café habits — tea, sweets, and long talk under citadel light.',
        'تمزج مقاهي أربيل عادات المقهى الكردية والعراقية — شاي وحلوى وحديث طويل تحت ضوء القلعة.'
      ),
      tags: tags(['Erbil', 'Tea', 'Night'], ['أربيل', 'شاي', 'ليل']),
      image: '/iraq/assets/hookah/erbil-cafe.jpg'
    },
    {
      id: 'river-terrace',
      emoji: '🌊',
      siteId: 'baghdad',
      name: b('Tigris terrace', 'شرفة دجلة'),
      tagline: b('River air, fish grill, and late cups', 'هواء النهر وشواء سمك وفناجين متأخرة'),
      history: b(
        'Abu Nuwas street and river terraces pair masgouf smoke with tea. The Tigris remains Baghdad’s evening living room.',
        'يزوّج شارع أبو نواس وشرفات النهر دخان المسگوف بالشاي. تبقى دجلة صالة مساء بغداد.'
      ),
      tags: tags(['Tigris', 'Terrace', 'Baghdad'], ['دجلة', 'شرفة', 'بغداد']),
      image: '/iraq/assets/hookah/river-terrace.jpg'
    }
  ],
  living: [
    {
      id: 'ashura',
      emoji: '🕯️',
      siteId: 'karbala',
      name: b('Ashura and Arbaeen', 'عاشوراء والأربعين'),
      tagline: b('Pilgrimage of mourning and devotion', 'حج حزن وولاء'),
      history: b(
        'Millions walk to Karbala for Arbaeen. Processions, latmiya chants, and open hospitality tents organize one of the world’s largest annual gatherings.',
        'يمشي الملايين إلى كربلاء في الأربعين. تنظّم المواكب واللطميات وخيام الضيافة واحداً من أكبر التجمعات السنوية في العالم.'
      ),
      tags: tags(['Pilgrimage', 'Karbala', 'Faith'], ['حج', 'كربلاء', 'إيمان']),
      image: '/iraq/assets/living/ashura.jpg'
    },
    {
      id: 'marsh-life',
      emoji: '🛶',
      siteId: 'ahwar',
      name: b('Marsh Arab life', 'حياة عرب الأهوار'),
      tagline: b('Reed architecture and water buffalo', 'عمارة قصب وجواميس ماء'),
      history: b(
        'The Ahwar wetlands hold mudhif reed halls, fishing economies, and UNESCO recognition. Drainage and war damaged the marshes; restoration continues.',
        'تحمل أهوار الأهوار قاعات المضيف القصبية واقتصاد صيد واعتراف اليونسكو. أضرّ التجفيف والحرب بالأهوار؛ ويتواصل الترميم.'
      ),
      tags: tags(['Marshes', 'UNESCO', 'Reed'], ['أهوار', 'يونسكو', 'قصب']),
      image: '/iraq/assets/living/marsh-life.jpg'
    },
    {
      id: 'calligraphy-baghdad',
      emoji: '✒️',
      siteId: 'baghdad',
      name: b('Baghdad calligraphy', 'خط بغداد'),
      tagline: b('Arabic script as living craft', 'الخط العربي كحرفة حية'),
      history: b(
        'Iraqi calligraphers carried Abbasid script traditions into modern posters, mosque bands, and school copybooks. The pen remains a public art.',
        'حمل الخطاطون العراقيون تقاليد الخط العباسي إلى ملصقات حديثة وأشرطة مساجد وكراسات مدارس. يبقى القلم فناً عاماً.'
      ),
      tags: tags(['Script', 'Art', 'Baghdad'], ['خط', 'فن', 'بغداد']),
      image: '/iraq/assets/living/calligraphy-baghdad.jpg'
    },
    {
      id: 'bazaar-souq',
      emoji: '🏪',
      siteId: 'baghdad',
      name: b('Souq life', 'حياة السوق'),
      tagline: b('Covered markets of spice and copper', 'أسواق مسقوفة للتوابل والنحاس'),
      history: b(
        'From Shorja to provincial souqs, markets organize scent, bargaining, and neighborhood news. Trade streets are Iraq’s oldest social media.',
        'من الشورجة إلى أسواق المحافظات تنظّم الأسواق الرائحة والمساومة وأخبار الحي. شوارع التجارة أقدم وسائل تواصل العراق.'
      ),
      tags: tags(['Market', 'Trade', 'City'], ['سوق', 'تجارة', 'مدينة']),
      image: '/iraq/assets/living/bazaar-souq.jpg'
    },
    {
      id: 'nowruz-north',
      emoji: '🔥',
      siteId: 'erbil',
      name: b('Nowruz in the north', 'نوروز في الشمال'),
      tagline: b('Spring fire and Kurdish new year', 'نار الربيع ورأس السنة الكردية'),
      history: b(
        'In Kurdistan, Nowruz gathers families around fire, dance, and picnic greens. It is seasonal joy shared with wider Iranian-plateau traditions.',
        'في كردستان يجمع نوروز العائلات حول النار والرقص ونزهات الخضرة. هو فرح موسمي مشترك مع تقاليد هضبة إيران الأوسع.'
      ),
      tags: tags(['Nowruz', 'Kurdish', 'Spring'], ['نوروز', 'كردي', 'ربيع']),
      image: '/iraq/assets/living/nowruz-north.jpg'
    },
    {
      id: 'hospitality',
      emoji: '🤝',
      siteId: 'najaf',
      name: b('Diyafa hospitality', 'الضيافة'),
      tagline: b('Open tables for guests and pilgrims', 'موائد مفتوحة للضيف والحاج'),
      history: b(
        'Offering tea, bread, and rest to strangers is a point of pride — especially along pilgrimage roads. Diyafa is ethics made edible.',
        'تقديم الشاي والخبز والراحة للغريب مفخرة — خاصة على طرق الحج. الضيافة أخلاق تؤكل.'
      ),
      tags: tags(['Hospitality', 'Guest', 'Tea'], ['ضيافة', 'ضيف', 'شاي']),
      image: '/iraq/assets/living/hospitality.jpg'
    }
  ],
  phrases: [
    { ar: 'أهلاً وسهلاً', translit: 'Ahlan wa sahlan', en: 'Welcome / hello' },
    { ar: 'مرحبا', translit: 'Marhaba', en: 'Hi' },
    { ar: 'شلونك؟', translit: 'Shlonak?', en: 'How are you? (Iraqi)' },
    { ar: 'الحمد لله', translit: 'Alhamdulillah', en: 'Praise God / I am well' },
    { ar: 'تشرفنا', translit: 'Tasharrafna', en: 'Pleased to meet you' },
    { ar: 'من فضلك', translit: 'Min fadlak', en: 'Please' },
    { ar: 'شكراً', translit: 'Shukran', en: 'Thank you' },
    { ar: 'مع السلامة', translit: 'Maʿa salama', en: 'Goodbye' },
    { ar: 'تعالي', translit: 'Taʿali', en: 'Come here (colloquial)' },
    { ar: 'تفضل', translit: 'Tafaddal', en: 'Please go ahead / help yourself' }
  ]
};

assertUiKeys(content.ui);

const reel = {
  id: 'iraq-hyperframes-reel',
  title: b('Iraq HyperFrame Tour', 'جولة العراق المصوّرة'),
  portrait: '/iraq/assets/zayd-guide-portrait-256.png',
  voice: { en: 'en-US-Neural2-D', ar: 'ar-XA-Wavenet-B' },
  pitch: -1,
  speakingRate: 0.98,
  scenes: [
    {
      id: 'welcome',
      anchor: 'iqHero',
      spotlight: '#iqHero',
      durationMs: 7200,
      kicker: b('Welcome', 'أهلاً'),
      title: b('Ahlan — Iraq', 'أهلاً — العراق'),
      copy: b('I am Zayd. Rivers, cities, and living tables — told with care.', 'أنا زيد. أنهار ومدن ومائدة حية — تُروى بعناية.'),
      narration: b(
        'Ahlan wa sahlan. I am Zayd. This atlas is Iraq — Sumer and Babylon, Abbasid Baghdad, marsh light, and a living table. Give me a few minutes and I will walk you through the map, the eras, and the flavors.',
        'أهلاً وسهلاً. أنا زيد. هذا الأطلس العراق — سومر وبابل، وبغداد العباسية، وضوء الأهوار، ومائدة حية. أعطني دقائق وأمشيك عبر الخريطة والعصور والنكهات.'
      )
    },
    {
      id: 'atlas',
      anchor: 'iqMap',
      spotlight: '#iqMap',
      action: 'openAtlas',
      durationMs: 7000,
      kicker: b('Atlas', 'أطلس'),
      title: b('The map opens', 'تُفتح الخريطة'),
      copy: b('Tigris bends, marsh reeds, desert edge — every pin a place.', 'انحناءات دجلة وقصب الأهوار وحافة الصحراء — كل علامة مكان.'),
      narration: b(
        'First, the atlas. From Baghdad to Basra, from Ur’s ziggurat to Erbil’s citadel — history pins, food towns, and living places. Select a name and the map leans in.',
        'أولاً الأطلس. من بغداد إلى البصرة، من زقورة أور إلى قلعة أربيل — علامات تاريخ وبلدات طعام وأماكن حيّة. اختر اسماً فتميل الخريطة نحوه.'
      )
    },
    {
      id: 'baghdad',
      anchor: 'iqMap',
      spotlight: '#iqMapCanvas',
      action: 'focusBaghdad',
      durationMs: 8200,
      kicker: b('Capital', 'العاصمة'),
      title: b('Baghdad', 'بغداد'),
      copy: b('Tigris capital of books and tea houses.', 'عاصمة دجلة للكتب وبيوت الشاي.'),
      narration: b(
        'Start in Baghdad. Abbasid scholars once filled its libraries; today cafés and river terraces still pace the city’s talk.',
        'نبدأ من بغداد. ملأ علماء عباسيون مكتباتها يوماً؛ واليوم ما زالت المقاهي وشرفات النهر تضبط حديث المدينة.'
      )
    },
    {
      id: 'babylon',
      anchor: 'iqMap',
      spotlight: '#iqMapCanvas',
      action: 'focusBabylon',
      durationMs: 7800,
      kicker: b('Ancient capital', 'عاصمة قديمة'),
      title: b('Babylon', 'بابل'),
      copy: b('Processions, law, and legendary walls.', 'مواكب وشريعة وأسوار أسطورية.'),
      narration: b(
        'Then Babylon — Hammurabi’s justice and Nebuchadnezzar’s processional city. The plain still holds the name that meant wonder.',
        'ثم بابل — عدل حمورابي ومدينة نبوخذ نصر المواكبية. ما زال السهل يحمل اسماً عنى العجب.'
      )
    },
    {
      id: 'ur',
      anchor: 'iqMap',
      spotlight: '#iqMapCanvas',
      action: 'focusUr',
      durationMs: 8000,
      kicker: b('Sumer', 'سومر'),
      title: b('Ur', 'أور'),
      copy: b('Ziggurat stairs above the southern plain.', 'أدراج الزقورة فوق السهل الجنوبي.'),
      narration: b(
        'South to Ur. The ziggurat rises where Sumerian kings buried treasure and prayed to the moon god — a first city still teaching beginnings.',
        'جنوباً إلى أور. ترتفع الزقورة حيث دفن ملوك سومر كنوزاً وصلّوا لإله القمر — مدينة أولى ما زالت تعلّم البدايات.'
      )
    },
    {
      id: 'eras',
      anchor: 'iqTimeline',
      spotlight: '#iqTimeline',
      action: 'openFirstEra',
      durationMs: 7500,
      kicker: b('Timeline', 'خط زمني'),
      title: b('Eras of Iraq', 'عصور العراق'),
      copy: b('Sumer to today — select a layer to hear it.', 'من سومر إلى اليوم — اختر طبقة لتسمعها.'),
      narration: b(
        'Open the timeline. Sumer, Babylon, Assyria, Abbasids, Ottomans, mandate kingdom, republic, and contemporary Iraq — each layer has a place on the map.',
        'افتح الخط الزمني. سومر وبابل وآشور والعباسيون والعثمانيون والمملكة الانتدابية والجمهورية والعراق المعاصر — لكل طبقة مكان على الخريطة.'
      )
    },
    {
      id: 'food',
      anchor: 'iqFood',
      spotlight: '#iqFoodGrid',
      action: 'flipFirstFood',
      durationMs: 7200,
      kicker: b('Table', 'مائدة'),
      title: b('Masgouf and quzi', 'مسگوف وقوزي'),
      copy: b('Flip a plate — river fish, feast rice, and kleicha.', 'اقلب طبقاً — سمك نهر وأرز وليمة وكليجة.'),
      narration: b(
        'At the table, masgouf grills by the river, quzi fills the tray, and kleicha sweetens Eid. Flip a card and I will tell you why patience tastes like hospitality here.',
        'على المائدة يُشوى المسگوف على النهر، ويملأ القوزي الصينية، وتحلّي الكليجة العيد. اقلب بطاقة وأخبرك لماذا يذوق الصبر كضيافة هنا.'
      )
    },
    {
      id: 'music',
      anchor: 'iqMusic',
      spotlight: '#iqMusicGrid',
      action: 'flipFirstMusic',
      durationMs: 7000,
      kicker: b('Sound', 'صوت'),
      title: b('Maqam and oud', 'مقام وعود'),
      copy: b('Baghdad suites, chalghi, and southern folk.', 'متتاليات بغداد وجلغي وشعبي الجنوب.'),
      narration: b(
        'Listen for Iraqi maqam, Baghdad oud, chalghi ensembles, southern marsh song, and Kurdish folk in the north. Flip a music card for the history behind the mode.',
        'اسمع المقام العراقي وعود بغداد وفرق الجلغي وأغنية الأهوار الجنوبية والأغنية الكردية في الشمال. اقلب بطاقة موسيقى لتقرأ الحكاية خلف المقام.'
      )
    },
    {
      id: 'majlis',
      anchor: 'iqHookah',
      spotlight: '#iqHookahGrid',
      action: 'flipFirstHookah',
      durationMs: 6800,
      kicker: b('Café', 'مقهى'),
      title: b('Tea before smoke', 'شاي قبل الدخان'),
      copy: b('Chai-khana talk — then slow nargileh.', 'حديث الچايخانه — ثم نرجيلة بطيئة.'),
      narration: b(
        'In the café, chai comes first. Newspapers, poetry, and river terraces still outlast the coals.',
        'في المقهى يأتي الشاي أولاً. ما زالت الصحف والشعر وشرفات النهر أطول عمراً من الجمر.'
      )
    },
    {
      id: 'living',
      anchor: 'iqLiving',
      spotlight: '#iqLivingGrid',
      action: 'flipFirstLiving',
      durationMs: 7200,
      kicker: b('Living', 'حياة'),
      title: b('Marshes and pilgrimage', 'أهوار وحج'),
      copy: b('Ashura roads, reed halls, and northern Nowruz.', 'طرق عاشوراء وقاعات قصب ونوروز الشمال.'),
      narration: b(
        'Living culture is Arbaeen hospitality, marsh mudhifs, souq bargaining, calligraphy, and Nowruz fires in the north. These are not museum labels — they still organize the year.',
        'الثقافة الحيّة هي ضيافة الأربعين ومضيف الأهوار ومساومة السوق والخط ونيران نوروز في الشمال. هذه ليست بطاقات متحف — ما زالت تنظّم السنة.'
      )
    },
    {
      id: 'phrases',
      anchor: 'iqPhrases',
      spotlight: '#iqPhraseList',
      action: 'speakFirstPhrase',
      durationMs: 6500,
      kicker: b('Speak', 'تكلّم'),
      title: b('Ahlan wa sahlan', 'أهلاً وسهلاً'),
      copy: b('Press a phrase — I will say it aloud.', 'اضغط عبارة — سأقولها بصوت عالٍ.'),
      narration: b(
        'Before you go, take an Iraqi greeting. Shlonak? Press any phrase on the page and I will say it for you in everyday Arabic.',
        'قبل أن تمضي، خذ تحية عراقية. شلونك؟ اضغط أي عبارة في الصفحة وسأقولها لك بعربية يومية.'
      )
    },
    {
      id: 'close',
      anchor: 'iqGuide',
      spotlight: '#iqGuide',
      action: 'unflipCards',
      durationMs: 7000,
      kicker: b('Ask me', 'اسألني'),
      title: b('I am still here', 'ما زلت هنا'),
      copy: b('Ask Zayd about Babylon, masgouf, or the marshes.', 'اسأل زيد عن بابل أو المسگوف أو الأهوار.'),
      narration: b(
        'That is the tour. Stay on the map, flip more cards, or ask me anything — Babylon’s walls, Ur’s ziggurat, masgouf grills, or the reed halls of the Ahwar. Maʿa salama for now, and welcome whenever you return.',
        'هذه هي الجولة. ابقَ على الخريطة، أو اقلب مزيداً من البطاقات، أو اسألني أي شيء — أسوار بابل، وزقورة أور، وأفران المسگوف، أو قاعات قصب الأهوار. مع السلامة الآن، وأهلاً بك كلما عدت.'
      )
    }
  ]
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, 'iraq-content.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8');
writeFileSync(path.join(OUT_DIR, 'iraq-story-reel.json'), `${JSON.stringify(reel, null, 2)}\n`, 'utf8');
console.log(`Wrote iraq-content.json (${content.eras.length} eras, ${content.sites.length} sites) and iraq-story-reel.json (${reel.scenes.length} scenes)`);
