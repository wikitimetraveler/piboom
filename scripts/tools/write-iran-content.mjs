#!/usr/bin/env node
/**
 * Write full bilingual Iran atlas content + story reel JSON.
 *   node scripts/tools/write-iran-content.mjs
 * Development work by David Lane
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public/iran/data');

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
  id: 'iran-atlas',
  brand: {
    name: b('Iran — Plateau of Empires', 'إيران — هضبة الإمبراطوريات'),
    tagline: b(
      'From Elam and Persepolis to Isfahan’s blue domes — history, table, and song on the Iranian plateau.',
      'من عيلام وبرسبوليس إلى قباب أصفهان الزرقاء — تاريخ ومائدة وغناء على الهضبة الإيرانية.'
    )
  },
  guide: {
    name: b('Nima', 'نیما'),
    title: b('Iran history guide', 'دليل تاريخ إيران'),
    portrait: '/iran/assets/nima-guide-portrait-256.png',
    greeting: b(
      'Salâm. I am Nima — walk with me from Tehran to Persepolis and Isfahan.',
      'سلام. أنا نیما — امشِ معي من طهران إلى برسبوليس وأصفهان.'
    )
  },
  ui: {
    en: {
      dir: 'ltr',
      langLabel: 'English',
      switchTo: 'عربي',
      heroKicker: 'The Iranian Plateau',
      heroTitle: 'Iran',
      heroLine:
        'A highland of empires between Caspian and Gulf — Achaemenid stone, Safavid blues, Nowruz fire, and a living table of kebab, tahdig, and tar.',
      playReel: 'Play HyperFrame tour',
      pauseReel: 'Pause tour',
      resumeReel: 'Resume tour',
      stopReel: 'Stop tour',
      narration: 'Narration',
      narrationScope: 'Entire page — atlas, tour, and cards',
      hearWelcome: 'Hear welcome',
      askGuide: 'Ask Nima',
      stop: 'Stop',
      listen: 'Listen',
      exploreMap: 'Explore the atlas',
      timelineHeading: 'Eras of Iran',
      timelineLead:
        'From Elamite Susa to the Islamic Republic. Select an era to hear it and find it on the map.',
      timelineSelectHint: 'Select an era on the timeline',
      mapHeading: 'Atlas of Iran',
      mapLead: 'Plateau, desert, and Caspian shore. Select a pin or a name to hear its story.',
      mapAll: 'All',
      mapHistory: 'History',
      mapFood: 'Food',
      mapMusic: 'Music',
      mapHookah: 'Café',
      mapLiving: 'Living',
      mapReset: 'Show all pins',
      mapLoading: 'Loading the atlas…',
      foodHeading: 'The Iranian table',
      foodLead: 'Chelo-kebab, ghormeh sabzi, fesenjan, and tahdig — flip a dish for its origin and meaning.',
      musicHeading: 'Sound of Iran',
      musicLead: 'Tar, setar, daf, and the radif. Flip a card for the history.',
      hookahHeading: 'Qahveh-khaneh — tea and slow talk',
      hookahLead: 'Chai, qalyān, and evening conversation — the Iranian café as social furniture.',
      livingHeading: 'Living cultures',
      livingLead: 'Nowruz, carpets, taarof, bazaars, calligraphy, and Chaharshanbe Suri fire.',
      phraseHeading: 'Speak with Iran',
      phraseLead: 'Everyday Arabic greetings useful across the region. Press any phrase to hear it.',
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
      meetGuide: 'Meet Nima'
    },
    ar: {
      dir: 'rtl',
      langLabel: 'العربية',
      switchTo: 'English',
      heroKicker: 'الهضبة الإيرانية',
      heroTitle: 'إيران',
      heroLine:
        'هضبة إمبراطوريات بين قزوين والخليج — حجر أخميني، وزرق صفوي، ونار نوروز، ومائدة حية من الكباب والتهديغ والطار.',
      playReel: 'شغّل الجولة',
      pauseReel: 'إيقاف مؤقت',
      resumeReel: 'متابعة الجولة',
      stopReel: 'إنهاء الجولة',
      narration: 'السرد الصوتي',
      narrationScope: 'الصفحة كاملة — الأطلس والجولة والبطاقات',
      hearWelcome: 'استمع للترحيب',
      askGuide: 'اسأل نیما',
      stop: 'إيقاف',
      listen: 'استمع',
      exploreMap: 'استكشف الأطلس',
      timelineHeading: 'عصور إيران',
      timelineLead: 'من سوسة العيلامية إلى الجمهورية الإسلامية. اختر حقبة لتسمعها وتجدها على الخريطة.',
      timelineSelectHint: 'اختر حقبة من الخط الزمني',
      mapHeading: 'أطلس إيران',
      mapLead: 'هضبة وصحراء وساحل قزوين. اختر علامة أو اسماً لتسمع حكايته.',
      mapAll: 'الكل',
      mapHistory: 'تاريخ',
      mapFood: 'طعام',
      mapMusic: 'موسيقى',
      mapHookah: 'مقهى',
      mapLiving: 'حياة',
      mapReset: 'أظهر كل العلامات',
      mapLoading: 'جارٍ تحميل الأطلس…',
      foodHeading: 'المائدة الإيرانية',
      foodLead: 'تشيلو كباب وقورمه سبزي وفسنجان وتهديغ — اقلب الطبق لتعرف أصله ومعناه.',
      musicHeading: 'صوت إيران',
      musicLead: 'طار وستار ودف والرديف. اقلب البطاقة لتقرأ الحكاية.',
      hookahHeading: 'قهوه‌خانه — شاي وحديث بطيء',
      hookahLead: 'شاي وقلیان وحديث المساء — المقهى الإيراني كأثاث اجتماعي.',
      livingHeading: 'ثقافات حيّة',
      livingLead: 'نوروز والسجاد والتعارف والأسواق والخط ونار چهارشنبه‌سوری.',
      phraseHeading: 'تكلّم مع إيران',
      phraseLead: 'تحيات عربية يومية مفيدة في المنطقة. اضغط أي عبارة لتسمعها.',
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
      meetGuide: 'تعرّف على نیما'
    }
  },
  eras: [
    {
      id: 'elam',
      siteId: 'susa',
      yearCE: -2200,
      years: b('c. 2700–539 BCE', 'نحو ٢٧٠٠–٥٣٩ ق.م'),
      title: b('Elam — Susa and the lowland edge', 'عيلام — سوسة وحافة السهل'),
      copy: b('Elamite kings ruled from Susa beside Mesopotamia.', 'حكم ملوك عيلام من سوسة إلى جوار بلاد الرافدين.'),
      narration: b(
        'We begin in Elam. Susa sat where the Iranian plateau meets the Mesopotamian lowlands — a kingdom of brick, seals, and long rivalry with Babylon.',
        'نبدأ بعيلام. جلست سوسة حيث تلتقي الهضبة الإيرانية بسهول الرافدين — مملكة طوب وأختام ومنافسة طويلة مع بابل.'
      ),
      history: b(
        'Elamite civilization centered on Susa and highland Anshan. Cuneiform and Elamite languages record diplomacy and war with Sumer, Akkad, and later Babylon. Archaeology at Susa shows ziggurat foundations, administrative tablets, and a court culture that preceded the Achaemenid empire on Iranian soil.',
        'تركّزت الحضارة العيلامية حول سوسة وعيلام الجبلية. تسجّل المسمارية واللغة العيلامية الدبلوماسية والحرب مع سومر وأكد ثم بابل. وتُظهر آثار سوسة أسس الزقورة وألواح الإدارة وثقافة بلاط سبقت الإمبراطورية الأخمينية على أرض إيران.'
      ),
      image: '/iran/assets/era/elam.jpg'
    },
    {
      id: 'achaemenid',
      siteId: 'persepolis',
      yearCE: -520,
      years: b('550–330 BCE', '٥٥٠–٣٣٠ ق.م'),
      title: b('Achaemenid empire', 'الإمبراطورية الأخمينية'),
      copy: b('Cyrus to Darius — Persepolis as ceremonial capital.', 'من كورش إلى داريوس — برسبوليس عاصمة احتفالية.'),
      narration: b(
        'Next, the Achaemenids. Cyrus founded a vast empire; Darius built Persepolis as a stage for New Year tribute. Stone stairs still remember the nations that climbed them.',
        'ثم الأخمينيون. أسّس كورش إمبراطورية واسعة؛ وبنى داريوس برسبوليس مسرحاً لجزية رأس السنة. ما زالت أدراج الحجر تتذكر الأمم التي صعدتها.'
      ),
      history: b(
        'The Achaemenid dynasty united the plateau with Anatolia, Egypt, and Central Asia under satrapies and the Royal Road. Persepolis, Pasargadae, and Susa were ceremonial and administrative centers. The empire fell to Alexander in 330 BCE, but its model of multiethnic rule shaped later Iranian states.',
        'وحّدت الأسرة الأخمينية الهضبة مع الأناضول ومصر وآسيا الوسطى عبر المرزبانيات والطريق الملكي. كانت برسبوليس وباسرغاد وسوسة مراكز احتفال وإدارة. سقطت الإمبراطورية أمام الإسكندر سنة ٣٣٠ ق.م، لكن نموذج الحكم المتعدد الأعراق شكّل الدول الإيرانية اللاحقة.'
      ),
      image: '/iran/assets/era/achaemenid.jpg'
    },
    {
      id: 'parthian-sasanian',
      siteId: 'susa',
      yearCE: 224,
      years: b('247 BCE – 651 CE', '٢٤٧ ق.م – ٦٥١ م'),
      title: b('Parthian and Sasanian Iran', 'إيران البارثية والساسانية'),
      copy: b('Horse archers, then Sasanian fire temples and rival Rome.', 'رماة خيل ثم معابد نار ساسانية ومنافسة روما.'),
      narration: b(
        'Parthians rode the steppe edge; Sasanians rebuilt an Iranian high culture of Zoroastrian fire, silk roads, and long wars with Rome and Byzantium.',
        'ركب البارثيون حافة السهوب؛ وأعاد الساسانيون بناء ثقافة إيرانية عليا من نار زرادشت وطرق الحرير وحروب طويلة مع روما وبيزنطة.'
      ),
      history: b(
        'The Arsacid Parthians and later Sasanian kings restored Iranian imperial identity after Alexander’s successors. Ctesiphon on the Tigris was a great capital; fire temples and rock reliefs marked Sasanian kingship. The Arab-Muslim conquest in the mid-seventh century ended Sasanian rule but not Persian language or court culture.',
        'أعاد البارثيون الأرساكيون ثم الملوك الساسانيون الهوية الإمبراطورية الإيرانية بعد خلفاء الإسكندر. كانت قطيسفون على دجلة عاصمة عظيمة؛ لوّنت معابد النار والنقوش الصخرية الملوكية الساسانية. أنهى الفتح العربي الإسلامي في منتصف القرن السابع الحكم الساساني لا اللغة الفارسية ولا ثقافة البلاط.'
      ),
      image: '/iran/assets/era/parthian-sasanian.jpg'
    },
    {
      id: 'islamic-persian',
      siteId: 'isfahan',
      yearCE: 850,
      years: b('7th–11th centuries', 'القرون ٧–١١ م'),
      title: b('Islamic Iran and Persian renaissance', 'إيران الإسلامية والنهضة الفارسية'),
      copy: b('Arabic administration, Persian poetry rising again.', 'إدارة عربية وشعر فارسي ينهض من جديد.'),
      narration: b(
        'After the conquest, Iran became part of the caliphate — yet Persian revived in poetry and local dynasties. Cities like Nishapur and Isfahan wove Islam with older plateau habits.',
        'بعد الفتح صارت إيران جزءاً من الخلافة — لكن الفارسية عادت في الشعر والدول المحلية. مدن مثل نيسابور وأصفهان نسجت الإسلام مع عادات الهضبة الأقدم.'
      ),
      history: b(
        'Under Umayyad and Abbasid rule, Iranian provinces supplied administrators, scholars, and soldiers. The Samanids and Buyids sponsored New Persian literature; Ferdowsi’s Shahnameh later crystallized national epic memory. Mosque architecture absorbed Sasanian techniques into Islamic forms.',
        'تحت الحكم الأموي والعباسي زوّدت الولايات الإيرانية الإدارة والعلماء والجنود. رعت السامانيون والبويهيون أدب الفارسية الجديدة؛ ثم بلور شاهنامه الفردوسي ذاكرة الملحمة الوطنية. وامتص عمارة المساجد تقنيات ساسانية في أشكال إسلامية.'
      ),
      image: '/iran/assets/era/islamic-persian.jpg'
    },
    {
      id: 'safavid',
      siteId: 'isfahan',
      yearCE: 1600,
      years: b('1501–1736', '١٥٠١–١٧٣٦'),
      title: b('Safavid Isfahan', 'أصفهان الصفوية'),
      copy: b('Shiʿi state, blue-tiled square, and silk capital.', 'دولة شيعية وساحة بلاط أزرق وعاصمة حرير.'),
      narration: b(
        'The Safavids made Twelver Shiʿism the state creed and rebuilt Isfahan as a luminous capital — Naqsh-e Jahan square, bridges, and bazaars still define the city’s face.',
        'جعل الصفويون التشيع الاثني عشري مذهب الدولة وأعادوا بناء أصفهان عاصمة مضيئة — ساحة نقش جهان والجسور والأسواق ما زالت تحدّد وجه المدينة.'
      ),
      history: b(
        'Shah Ismail I founded the Safavid dynasty; Shah Abbas I moved the capital to Isfahan and remade it as a planned imperial city. Trade with Europe, Armenian merchants in New Julfa, and monumental mosques made Safavid Iran a peer of Ottoman and Mughal courts.',
        'أسّس الشاه إسماعيل الأول الأسرة الصفوية؛ ونقل الشاه عباس الأول العاصمة إلى أصفهان وأعاد صوغها مدينة إمبراطورية مخطّطة. جعلت التجارة مع أوروبا وتجار الأرمن في جلفا الجديدة والمساجد الضخمة إيران الصفوية نداً للعثمانيين والمغول.'
      ),
      image: '/iran/assets/era/safavid.jpg'
    },
    {
      id: 'qajar',
      siteId: 'tehran',
      yearCE: 1795,
      years: b('1789–1925', '١٧٨٩–١٩٢٥'),
      title: b('Qajar Tehran', 'طهران القاجارية'),
      copy: b('A new capital between empire and modern pressure.', 'عاصمة جديدة بين الإمبراطورية وضغط الحداثة.'),
      narration: b(
        'The Qajars made Tehran their capital. Photography, telegraph, and European embassies arrived while tribes and provinces still negotiated power with the court.',
        'جعل القاجاريون طهران عاصمتهم. وصل التصوير والتلغراف والسفارات الأوروبية بينما كانت القبائل والولايات ما زالت تتفاوض على السلطة مع البلاط.'
      ),
      history: b(
        'Agha Mohammad Khan established Qajar rule; Tehran grew from a modest town into a royal seat. The Constitutional Revolution (1905–1911) sought a parliament and limited monarchy. Oil, concessions, and Anglo-Russian rivalry framed late Qajar politics.',
        'ثبّت آغا محمد خان الحكم القاجاري؛ ونمت طهران من بلدة متواضعة إلى مقر ملكي. سعت الثورة الدستورية (١٩٠٥–١٩١١) إلى برلمان وملكية مقيّدة. شكّل النفط والامتيازات والتنافس الأنجلو-روسي سياسة أواخر القاجار.'
      ),
      image: '/iran/assets/era/qajar.jpg'
    },
    {
      id: 'pahlavi',
      siteId: 'tehran',
      yearCE: 1935,
      years: b('1925–1979', '١٩٢٥–١٩٧٩'),
      title: b('Pahlavi modernization', 'التحديث البهلوي'),
      copy: b('Nation-state reforms, oil, and rapid urban change.', 'إصلاحات دولة قومية ونفط وتغيير حضري سريع.'),
      narration: b(
        'Under the Pahlavis, Iran was renamed in Western diplomacy, railways and universities expanded, and Tehran sprawled — until the 1979 revolution remade the state.',
        'تحت البهلويين أُعيدت تسمية إيران في الدبلوماسية الغربية، واتسعت السكك والجامعات، وامتدت طهران — حتى أعادت ثورة ١٩٧٩ صياغة الدولة.'
      ),
      history: b(
        'Reza Shah founded the Pahlavi dynasty and pursued centralizing reforms. Mohammad Reza Shah’s White Revolution redistributed land and expanded literacy amid oil wealth and political repression. The 1979 Islamic Revolution ended the monarchy and established the Islamic Republic.',
        'أسّس رضا شاه الأسرة البهلوية وسعى لإصلاحات مركزيّة. أعادت الثورة البيضاء لمحمد رضا شاه توزيع الأرض ووسّعت محو الأمية وسط ثروة نفطية وقمع سياسي. أنهت الثورة الإسلامية عام ١٩٧٩ الملكية وأقامت الجمهورية الإسلامية.'
      ),
      image: '/iran/assets/era/pahlavi.jpg'
    },
    {
      id: 'contemporary',
      siteId: 'tehran',
      yearCE: 1979,
      years: b('1979 – today', '١٩٧٩ – اليوم'),
      title: b('Islamic Republic and living Iran', 'الجمهورية الإسلامية وإيران الحيّة'),
      copy: b('Revolution, war, and a young urban culture still at table.', 'ثورة وحرب وثقافة حضرية شابة ما زالت على المائدة.'),
      narration: b(
        'Contemporary Iran is republic and plateau memory at once — Nowruz fires, bazaar talk, poetry, and cities from Mashhad to Bandar Abbas living beside politics that fill the news.',
        'إيران المعاصرة جمهورية وذاكرة هضبة معاً — نيران نوروز وحديث البازار والشعر ومدن من مشهد إلى بندر عباس تعيش إلى جوار سياسة تملأ الأخبار.'
      ),
      history: b(
        'Since 1979 Iran has been an Islamic Republic. The Iran–Iraq War (1980–1988) shaped a generation. Today the country remains a major regional power with deep literary, culinary, and musical traditions that continue in homes and cafés regardless of headlines.',
        'منذ ١٩٧٩ إيران جمهورية إسلامية. شكّلت حرب إيران والعراق (١٩٨٠–١٩٨٨) جيلاً. تبقى البلاد اليوم قوة إقليمية كبرى بتقاليد أدبية وطعامية وموسيقية عميقة تستمر في البيوت والمقاهي بمعزل عن العناوين.'
      ),
      image: '/iran/assets/era/contemporary.jpg'
    }
  ],
  sites: [
    {
      id: 'tehran',
      category: 'history',
      emoji: '🏙️',
      lat: 35.6892,
      lng: 51.389,
      unesco: false,
      name: b('Tehran', 'طهران'),
      place: b('Capital', 'العاصمة'),
      blurb: b('Modern capital between Alborz peaks and plateau smog.', 'عاصمة حديثة بين قمم البرز وضباب الهضبة.')
    },
    {
      id: 'isfahan',
      category: 'history',
      emoji: '🕌',
      lat: 32.6546,
      lng: 51.668,
      unesco: true,
      name: b('Isfahan', 'أصفهان'),
      place: b('Central plateau', 'الهضبة الوسطى'),
      blurb: b('Safavid square, bridges, and blue-tiled mosques.', 'ساحة صفوية وجسور ومساجد بلاط أزرق.')
    },
    {
      id: 'persepolis',
      category: 'history',
      emoji: '🏛️',
      lat: 29.9356,
      lng: 52.8916,
      unesco: true,
      name: b('Persepolis', 'برسبوليس'),
      place: b('Fars', 'فارس'),
      blurb: b('Achaemenid ceremonial capital of stone stairs and reliefs.', 'عاصمة أخمينية احتفالية بدرجات حجر ونقوش.')
    },
    {
      id: 'shiraz',
      category: 'music',
      emoji: '🌹',
      lat: 29.5918,
      lng: 52.5837,
      unesco: false,
      name: b('Shiraz', 'شيراز'),
      place: b('Fars', 'فارس'),
      blurb: b('City of poets, gardens, and nearby Persepolis.', 'مدينة الشعراء والحدائق وبرسبوليس القريبة.')
    },
    {
      id: 'yazd',
      category: 'living',
      emoji: '🏜️',
      lat: 31.8974,
      lng: 54.3569,
      unesco: true,
      name: b('Yazd', 'يزد'),
      place: b('Desert city', 'مدينة صحراوية'),
      blurb: b('Windcatchers, Zoroastrian heritage, and adobe lanes.', 'ملاقف هواء وتراث زرادشتي وأزقة طين.')
    },
    {
      id: 'tabriz',
      category: 'living',
      emoji: '🧵',
      lat: 38.0962,
      lng: 46.2738,
      unesco: true,
      name: b('Tabriz', 'تبريز'),
      place: b('Northwest', 'الشمال الغربي'),
      blurb: b('Historic bazaar and carpet city of Azerbaijan.', 'بازار تاريخي ومدينة سجاد أذربيجان.')
    },
    {
      id: 'mashhad',
      category: 'living',
      emoji: '✨',
      lat: 36.2605,
      lng: 59.6168,
      unesco: false,
      name: b('Mashhad', 'مشهد'),
      place: b('Khorasan', 'خراسان'),
      blurb: b('Shrine city and pilgrimage capital of the east.', 'مدينة مقام وعاصمة حج الشرق.')
    },
    {
      id: 'susa',
      category: 'history',
      emoji: '🧱',
      lat: 32.1892,
      lng: 48.2578,
      unesco: true,
      name: b('Susa', 'سوسة'),
      place: b('Khuzestan', 'خوزستان'),
      blurb: b('Elamite and Achaemenid lowland capital.', 'عاصمة عيلامية وأخمينية في السهل.')
    },
    {
      id: 'kashan',
      category: 'food',
      emoji: '🏡',
      lat: 33.985,
      lng: 51.41,
      unesco: false,
      name: b('Kashan', 'كاشان'),
      place: b('Oasis towns', 'بلدات الواحات'),
      blurb: b('Rose water, historic houses, and desert-edge gardens.', 'ماء ورد وبيوت تاريخية وحدائق حافة الصحراء.')
    },
    {
      id: 'bandar-abbas',
      category: 'food',
      emoji: '⚓',
      lat: 27.1865,
      lng: 56.2808,
      unesco: false,
      name: b('Bandar Abbas', 'بندر عباس'),
      place: b('Persian Gulf', 'الخليج الفارسي'),
      blurb: b('Gulf port of fish, heat, and southern spice.', 'ميناء خليجي للسمك والحرارة وتوابل الجنوب.')
    },
    {
      id: 'pasargadae',
      category: 'history',
      emoji: '⚱️',
      lat: 30.2,
      lng: 53.179,
      unesco: true,
      name: b('Pasargadae', 'باسرغاد'),
      place: b('Fars', 'فارس'),
      blurb: b('Tomb of Cyrus in a quiet plain.', 'قبر كورش في سهل هادئ.')
    },
    {
      id: 'rasht',
      category: 'food',
      emoji: '🌿',
      lat: 37.2808,
      lng: 49.5832,
      unesco: false,
      name: b('Rasht', 'رشت'),
      place: b('Caspian Gilan', 'جيلان على قزوين'),
      blurb: b('Rainy green north — herbs, fish, and Caspian kitchens.', 'شمال أخضر ممطر — أعشاب وسمك ومطابخ قزوين.')
    }
  ],
  foods: [
    {
      id: 'chelo-kebab',
      emoji: '🥙',
      siteId: 'tehran',
      name: b('Chelo kebab', 'تشيلو كباب'),
      tagline: b('Butter rice with charcoal-grilled meat', 'أرز بالزبدة مع لحم مشوي على الفحم'),
      history: b(
        'Iran’s national plate pairing: fluffy chelo rice, often with a golden tahdig edge, beside koobideh or barg kebab. Restaurants from Tehran to Shiraz treat the rice tray as ceremony.',
        'طبق إيران الوطني المقترن: أرز تشيلو منفوش، غالباً بحافة تهديغ ذهبية، إلى جوار كباب كوبيده أو برگ. تعامل المطاعم من طهران إلى شيراز صينية الأرز كشعيرة.'
      ),
      tags: tags(['Rice', 'Grill', 'National'], ['أرز', 'شواء', 'وطني']),
      image: '/iran/assets/food/chelo-kebab.jpg'
    },
    {
      id: 'ghormeh-sabzi',
      emoji: '🍲',
      siteId: 'tehran',
      name: b('Ghormeh sabzi', 'قورمه سبزي'),
      tagline: b('Herb stew with kidney beans and dried lime', 'يخنة أعشاب مع فاصوليا وليمون مجفف'),
      history: b(
        'Finely chopped herbs fried dark, then simmered with meat, beans, and limoo amani. Many Iranians call it the true comfort stew — bitter-lime brightness over deep green.',
        'أعشاب مفرومة تُقلى حتى تغمق ثم تُطهى مع اللحم والفاصوليا والليمون العماني. يسميها كثير من الإيرانيين يخنة الراحة الحقيقية — سطوع الليمون المر فوق أخضر عميق.'
      ),
      tags: tags(['Stew', 'Herbs', 'Home'], ['يخنة', 'أعشاب', 'بيت']),
      image: '/iran/assets/food/ghormeh-sabzi.jpg'
    },
    {
      id: 'fesenjan',
      emoji: '🍗',
      siteId: 'rasht',
      name: b('Fesenjan', 'فسنجان'),
      tagline: b('Walnut and pomegranate stew', 'يخنة الجوز والرمان'),
      history: b(
        'Ground walnuts and pomegranate molasses cook into a sweet-tart sauce for duck or chicken. Northern and Caspian tables especially prize this dark, festive khoresh.',
        'يُطحن الجوز ودبس الرمان حتى يصيرا صلصة حلوة حامضة للبط أو الدجاج. تقدّر موائد الشمال وقزوين خاصة هذه اليخنة الداكنة الاحتفالية.'
      ),
      tags: tags(['Walnut', 'Pomegranate', 'Feast'], ['جوز', 'رمان', 'عيد']),
      image: '/iran/assets/food/fesenjan.jpg'
    },
    {
      id: 'tahdig',
      emoji: '🍚',
      siteId: 'isfahan',
      name: b('Tahdig', 'ته‌دیگ'),
      tagline: b('The crisp golden rice crust', 'قشرة الأرز الذهبية المقرمشة'),
      history: b(
        'Tahdig is the prize at the bottom of the pot — rice, bread, or potato fried into a shatteringly crisp lid. Sharing the best shards is a quiet etiquette of love.',
        'التهديغ غنيمة قاع القدر — أرز أو خبز أو بطاطا تُقلى حتى تصير غطاء مقرمشاً. تقاسم أفضل القطع آداب حب هادئة.'
      ),
      tags: tags(['Rice', 'Crisp', 'Family'], ['أرز', 'مقرمش', 'عائلة']),
      image: '/iran/assets/food/tahdig.jpg'
    },
    {
      id: 'ash-reshteh',
      emoji: '🍜',
      siteId: 'tabriz',
      name: b('Ash reshteh', 'آش رشته'),
      tagline: b('Thick noodle and herb soup of Nowruz', 'حساء معكرونة وأعشاب لنوروز'),
      history: b(
        'Beans, noodles, greens, and kashk yogurt whey make a winter-to-spring bowl. Served for Nowruz and charity kitchens — fullness as blessing.',
        'فاصوليا ومعكرونة وخضار وكشك تصنع وعاء من الشتاء إلى الربيع. يُقدَّم في نوروز ومطابخ الخير — الشبع كبركة.'
      ),
      tags: tags(['Soup', 'Nowruz', 'Noodles'], ['حساء', 'نوروز', 'معكرونة']),
      image: '/iran/assets/food/ash-reshteh.jpg'
    },
    {
      id: 'zereshk-polo',
      emoji: '🍒',
      siteId: 'mashhad',
      name: b('Zereshk polo', 'زرشک پلو'),
      tagline: b('Barberry rice with saffron chicken', 'أرز البرباريس مع دجاج الزعفران'),
      history: b(
        'Ruby barberries sautéed with sugar and saffron crown jeweled rice. A wedding and Friday classic — tart fruit against golden grain.',
        'برباريس ياقوتي يُقلى مع السكر والزعفران يتوّج أرزاً مرصعاً. كلاسيكية أعراس وجمعة — فاكهة حامضة مقابل حبّة ذهبية.'
      ),
      tags: tags(['Rice', 'Saffron', 'Celebration'], ['أرز', 'زعفران', 'احتفال']),
      image: '/iran/assets/food/zereshk-polo.jpg'
    },
    {
      id: 'doogh',
      emoji: '🥛',
      siteId: 'shiraz',
      name: b('Doogh', 'دوغ'),
      tagline: b('Salty yogurt drink with mint', 'مشروب لبن مالح بالنعناع'),
      history: b(
        'Yogurt thinned with water or soda, salted, and brightened with dried mint. The cooling companion to kebab on hot plateau afternoons.',
        'لبن يُخفَّف بالماء أو الصودا ويُملَّح ويُنعش بنعناع مجفف. رفيق تبريد الكباب في ظهيرات الهضبة الحارة.'
      ),
      tags: tags(['Drink', 'Yogurt', 'Mint'], ['مشروب', 'لبن', 'نعناع']),
      image: '/iran/assets/food/doogh.jpg'
    },
    {
      id: 'sangak',
      emoji: '🍞',
      siteId: 'kashan',
      name: b('Sangak', 'سنگک'),
      tagline: b('Pebble-baked whole-wheat flatbread', 'خبز قمح يُخبز على الحصى'),
      history: b(
        'Long loaves baked on hot river stones in a vaulted oven. Sangak is daily bread of cities — torn for cheese, herbs, and morning tea.',
        'أرغفة طويلة تُخبز على حصى نهر ساخن في فرن مقبوّ. السنگک خبز المدن اليومي — يُمزَّق للجبن والأعشاب وشاي الصباح.'
      ),
      tags: tags(['Bread', 'Bakery', 'Daily'], ['خبز', 'فرن', 'يومي']),
      image: '/iran/assets/food/sangak.jpg'
    }
  ],
  music: [
    {
      id: 'tar',
      emoji: '🎸',
      siteId: 'tehran',
      name: b('Tar', 'تار'),
      tagline: b('Long-necked lute of classical Iran', 'عود طويل العنق للموسيقى الكلاسيكية'),
      history: b(
        'The tar’s double bowl and fretted neck carry the radif’s melodic memory. Masters from Tehran and Isfahan shaped modern classical performance.',
        'يحمل وعاء التار المزدوج وعنقُه ذو الدساتين ذاكرة الرديف اللحنية. شكّل أساتذة طهران وأصفهان الأداء الكلاسيكي الحديث.'
      ),
      tags: tags(['Lute', 'Classical', 'Radif'], ['عود', 'كلاسيكي', 'رديف']),
      image: '/iran/assets/music/tar.jpg'
    },
    {
      id: 'setar',
      emoji: '🎵',
      siteId: 'isfahan',
      name: b('Setar', 'سه‌تار'),
      tagline: b('Intimate four-string companion of solitude', 'رفيق العزلة ذو الأوتار الأربعة'),
      history: b(
        'Quieter than the tar, the setar suits night practice and mystical verse. Its whisper fits rooms more than stages — poetry made audible.',
        'أهدأ من التار، يناسب السه‌تار تمرين الليل والشعر الصوفي. همسُه للغرف أكثر من المسارح — شعرٌ يُسمَع.'
      ),
      tags: tags(['Lute', 'Intimate', 'Night'], ['عود', 'حميمي', 'ليل']),
      image: '/iran/assets/music/setar.jpg'
    },
    {
      id: 'daf',
      emoji: '🥁',
      siteId: 'tabriz',
      name: b('Daf', 'دف'),
      tagline: b('Frame drum of Sufi gatherings and stages', 'طار بإطار لجلسات الصوفية والمسارح'),
      history: b(
        'The daf’s rings shimmer in Kurdish, Persian, and Sufi contexts. Once ritual, now also concert hall — rhythm that opens a circle.',
        'ترنّ حلقات الدف في سياقات كردية وفارسية وصوفية. كان طقساً وصار أيضاً قاعة حفل — إيقاع يفتح حلقة.'
      ),
      tags: tags(['Drum', 'Sufi', 'Circle'], ['طبل', 'صوفي', 'حلقة']),
      image: '/iran/assets/music/daf.jpg'
    },
    {
      id: 'radif',
      emoji: '📜',
      siteId: 'shiraz',
      name: b('Radif', 'رديف'),
      tagline: b('Canonical melodic repertoire of dastgāh', 'الذخيرة اللحنية القانونية للدستگاه'),
      history: b(
        'The radif is a remembered sequence of gushehs taught master to pupil. UNESCO recognizes it as intangible heritage — a living curriculum of mode and mood.',
        'الرديف تسلسل محفوظ من الغوشات يُعلَّم من أستاذ إلى تلميذ. تعترف به اليونسكو تراثاً غير مادي — منهج حي للمقام والمزاج.'
      ),
      tags: tags(['Classical', 'UNESCO', 'Mode'], ['كلاسيكي', 'يونسكو', 'مقام']),
      image: '/iran/assets/music/radif.jpg'
    },
    {
      id: 'folk-kurdish',
      emoji: '🏞️',
      siteId: 'tabriz',
      name: b('Kurdish folk song', 'أغنية كردية شعبية'),
      tagline: b('Mountain voices of the northwest', 'أصوات جبلية من الشمال الغربي'),
      history: b(
        'Kurdish and Lori song traditions share dances, epic ballads, and wedding rhythms across western Iran. Language and landscape shape the beat.',
        'تتشارك تقاليد الأغنية الكردية واللورية رقصات وملحمات وإيقاعات أعراس غرب إيران. اللغة والمنظر يشكّلان الإيقاع.'
      ),
      tags: tags(['Folk', 'Kurdish', 'Dance'], ['شعبي', 'كردي', 'رقص']),
      image: '/iran/assets/music/folk-kurdish.jpg'
    },
    {
      id: 'contemporary',
      emoji: '🎧',
      siteId: 'tehran',
      name: b('Contemporary Iranian music', 'موسيقى إيرانية معاصرة'),
      tagline: b('Pop, fusion, and underground Tehran nights', 'بوب واندماج وليالٍ تحت الأرض في طهران'),
      history: b(
        'From pre-revolution pop memory to today’s fusion and diaspora stages, Iranian musicians remix radif modes with global forms — always arguing with silence and censorship.',
        'من ذاكرة البوب قبل الثورة إلى الاندماج ومسارح الشتات اليوم، يعيد الموسيقيون الإيرانيون مزج مقامات الرديف بأشكال عالمية — دائماً في جدال مع الصمت والرقابة.'
      ),
      tags: tags(['Pop', 'Fusion', 'Urban'], ['بوب', 'اندماج', 'حضري']),
      image: '/iran/assets/music/contemporary.jpg'
    }
  ],
  hookah: [
    {
      id: 'qalyun-chai',
      emoji: '🫖',
      siteId: 'tehran',
      name: b('Chai and qalyān', 'شاي وقلیان'),
      tagline: b('Tea first, then the water pipe', 'الشاي أولاً ثم النرجيلة'),
      history: b(
        'Iranian café culture pours strong chai before or beside qalyān. The ritual is conversation timed by coals — not rushing the story.',
        'تصب ثقافة المقاهي الإيرانية شاياً قوياً قبل القلیان أو إلى جواره. الطقس حديث موقوت بالجمر — لا يستعجل الحكاية.'
      ),
      tags: tags(['Tea', 'Café', 'Talk'], ['شاي', 'مقهى', 'حديث']),
      image: '/iran/assets/hookah/qalyun-chai.jpg'
    },
    {
      id: 'qahveh-khaneh',
      emoji: '☕',
      siteId: 'isfahan',
      name: b('Qahveh-khaneh', 'قهوه‌خانه'),
      tagline: b('Traditional coffeehouse of storytellers', 'مقهى تقليدي للحكّائين'),
      history: b(
        'Historic coffeehouses hosted naqqali storytelling and wrestling posters. Today many serve tea and games — public living rooms for men and mixed youth spaces.',
        'استضافت المقاهي التاريخية سرد النقالي وملصقات المصارعة. اليوم كثير منها يقدّم الشاي والألعاب — صالونات عامة للرجال ومساحات شباب مختلطة.'
      ),
      tags: tags(['Coffeehouse', 'Story', 'Public'], ['مقهى', 'حكاية', 'عام']),
      image: '/iran/assets/hookah/qahveh-khaneh.jpg'
    },
    {
      id: 'isfahan-bridge-evening',
      emoji: '🌉',
      siteId: 'isfahan',
      name: b('Bridge evening tea', 'شاي مساء الجسر'),
      tagline: b('Si-o-se-pol light and slow sips', 'ضوء سي‌وسه‌پل ورشفات بطيئة'),
      history: b(
        'Families and friends gather near Isfahan’s bridges at dusk. Tea vendors and riverside talk turn architecture into a nightly majlis.',
        'تجتمع العائلات والأصدقاء قرب جسور أصفهان عند الغسق. باعة الشاي وحديث الضفة يحوّلان العمارة إلى مجلس ليلي.'
      ),
      tags: tags(['Isfahan', 'Evening', 'Bridge'], ['أصفهان', 'مساء', 'جسر']),
      image: '/iran/assets/hookah/isfahan-bridge-evening.jpg'
    },
    {
      id: 'shiraz-garden-smoke',
      emoji: '🌿',
      siteId: 'shiraz',
      name: b('Garden café smoke', 'دخان مقهى الحديقة'),
      tagline: b('Rose gardens, poetry, and mild qalyān', 'حدائق ورد وشعر وقلیان لطيف'),
      history: b(
        'Shiraz cafés lean into garden shade and Hafez memory. A mild pipe may appear — the older grammar is still recite, sip, and linger.',
        'تميل مقاهي شيراز إلى ظل الحدائق وذاكرة حافظ. قد يظهر أنبوب لطيف — القواعد الأقدم ما زالت: أَنشد، وارشف، وتباطأ.'
      ),
      tags: tags(['Garden', 'Poetry', 'Shiraz'], ['حديقة', 'شعر', 'شيراز']),
      image: '/iran/assets/hookah/shiraz-garden-smoke.jpg'
    }
  ],
  living: [
    {
      id: 'nowruz',
      emoji: '🌱',
      siteId: 'tehran',
      name: b('Nowruz', 'نوروز'),
      tagline: b('Spring new year across the plateau', 'رأس سنة الربيع عبر الهضبة'),
      history: b(
        'Nowruz marks the spring equinox with haft-sin tables, house cleaning, and family visits. UNESCO lists it as shared heritage across many countries — Iran’s most public living festival.',
        'يعلّم نوروز الاعتدال الربيعي بمائدة هفت‌سين وتنظيف البيت وزيارات العائلة. تدرجه اليونسكو تراثاً مشتركاً عبر بلدان كثيرة — أكثر مهرجانات إيران الحيّة علنية.'
      ),
      tags: tags(['Spring', 'Festival', 'UNESCO'], ['ربيع', 'مهرجان', 'يونسكو']),
      image: '/iran/assets/living/nowruz.jpg'
    },
    {
      id: 'carpets',
      emoji: '🧶',
      siteId: 'tabriz',
      name: b('Persian carpets', 'السجاد الفارسي'),
      tagline: b('Knotted gardens underfoot', 'حدائق معقودة تحت القدم'),
      history: b(
        'From Tabriz to Kashan, workshops knot medallions and hunting scenes into wool and silk. Carpets are export art, dowry wealth, and floor theology of paradise gardens.',
        'من تبريز إلى كاشان تعقد الورش ميداليات ومشاهد صيد في صوف وحرير. السجاد فن تصدير وثروة مهر ولاهوت أرض لحدائق الفردوس.'
      ),
      tags: tags(['Craft', 'Wool', 'Export'], ['حرفة', 'صوف', 'تصدير']),
      image: '/iran/assets/living/carpets.jpg'
    },
    {
      id: 'taarof',
      emoji: '🤝',
      siteId: 'isfahan',
      name: b('Taarof', 'تعارف'),
      tagline: b('Ritual courtesy of offering and refusal', 'مجاملة طقسية للعرض والرفض'),
      history: b(
        'Taarof is the polite dance of insisting and declining — paying a bill, entering a door, accepting tea. Reading the real yes takes practice and kindness.',
        'التعارف رقصة مهذبة للإصرار والاعتذار — دفع فاتورة، ودخول باب، وقبول شاي. قراءة الـ«نعم» الحقيقية تحتاج تمريناً ولطفاً.'
      ),
      tags: tags(['Etiquette', 'Hospitality', 'Speech'], ['آداب', 'ضيافة', 'كلام']),
      image: '/iran/assets/living/taarof.jpg'
    },
    {
      id: 'bazaar',
      emoji: '🏪',
      siteId: 'tabriz',
      name: b('Bazaar', 'البازار'),
      tagline: b('Vaulted markets of spice and talk', 'أسواق مقبوّة للتوابل والحديث'),
      history: b(
        'Iranian bazaars are covered cities of guilds — copper, carpet, spice, and gold. UNESCO-listed Tabriz Historic Bazaar Complex is one living example of trade as urban form.',
        'البازارات الإيرانية مدن مسقوفة للنقابات — نحاس وسجاد وتوابل وذهب. مجمع بازار تبريز التاريخي المدرج في اليونسكو مثال حي للتجارة كشكل حضري.'
      ),
      tags: tags(['Market', 'UNESCO', 'Guild'], ['سوق', 'يونسكو', 'نقابة']),
      image: '/iran/assets/living/bazaar.jpg'
    },
    {
      id: 'calligraphy',
      emoji: '✒️',
      siteId: 'mashhad',
      name: b('Persian calligraphy', 'الخط الفارسي'),
      tagline: b('Nastaʿliq as visual music', 'نستعلیق كموسيقى بصرية'),
      history: b(
        'Nastaʿliq script turns poetry into architecture on paper. Calligraphy schools still train the wrist that writes Hafez and Quranic pages alike.',
        'يحوّل خط النستعلیق الشعر إلى عمارة على الورق. ما زالت مدارس الخط تدرّب المعصم الذي يكتب حافظ وصفحات القرآن معاً.'
      ),
      tags: tags(['Script', 'Poetry', 'Art'], ['خط', 'شعر', 'فن']),
      image: '/iran/assets/living/calligraphy.jpg'
    },
    {
      id: 'chaharshanbe-suri',
      emoji: '🔥',
      siteId: 'tehran',
      name: b('Chaharshanbe Suri', 'چهارشنبه‌سوری'),
      tagline: b('Fire-jumping night before the last Wednesday', 'ليلة قفز النار قبل الأربعاء الأخير'),
      history: b(
        'Before Nowruz, communities leap over bonfires saying the old rhyme that trades yellowness for fire’s red health. Urban balconies still glow with the ritual.',
        'قبل نوروز يقفز الناس فوق نيران مردّدين القافية القديمة التي تستبدل الصفرة بحمرة النار الصحية. ما زالت شرفات المدن تتوهج بالطقس.'
      ),
      tags: tags(['Fire', 'Nowruz', 'Ritual'], ['نار', 'نوروز', 'طقس']),
      image: '/iran/assets/living/chaharshanbe-suri.jpg'
    }
  ],
  phrases: [
    { ar: 'أهلاً وسهلاً', translit: 'Ahlan wa sahlan', en: 'Welcome / hello' },
    { ar: 'مرحبا', translit: 'Marhaba', en: 'Hi' },
    { ar: 'السلام عليكم', translit: 'As-salāmu ʿalaykum', en: 'Peace be upon you' },
    { ar: 'كيف حالك؟', translit: 'Kayf halak?', en: 'How are you?' },
    { ar: 'الحمد لله', translit: 'Alhamdulillah', en: 'Praise God / I am well' },
    { ar: 'تشرفنا', translit: 'Tasharrafna', en: 'Pleased to meet you' },
    { ar: 'من فضلك', translit: 'Min fadlak', en: 'Please' },
    { ar: 'شكراً', translit: 'Shukran', en: 'Thank you' },
    { ar: 'مع السلامة', translit: 'Maʿa salama', en: 'Goodbye' },
    { ar: 'تفضل', translit: 'Tafaddal', en: 'Please go ahead / help yourself' }
  ]
};

assertUiKeys(content.ui);

const reel = {
  id: 'iran-hyperframes-reel',
  title: b('Iran HyperFrame Tour', 'جولة إيران المصوّرة'),
  portrait: '/iran/assets/nima-guide-portrait-256.png',
  voice: { en: 'en-US-Neural2-D', ar: 'ar-XA-Wavenet-B' },
  pitch: -1,
  speakingRate: 0.98,
  scenes: [
    {
      id: 'welcome',
      anchor: 'irHero',
      spotlight: '#irHero',
      durationMs: 7200,
      kicker: b('Welcome', 'أهلاً'),
      title: b('Salâm — Iran', 'سلام — إيران'),
      copy: b('I am Nima. Plateau, empires, and living tables — told with care.', 'أنا نیما. هضبة وإمبراطوريات ومائدة حية — تُروى بعناية.'),
      narration: b(
        'Salâm. I am Nima. This atlas is Iran — Elam and Persepolis, Safavid Isfahan, Nowruz fire, and a living table. Give me a few minutes and I will walk you through the map, the eras, and the flavors.',
        'سلام. أنا نیما. هذا الأطلس إيران — عيلام وبرسبوليس، وأصفهان الصفوية، ونار نوروز، ومائدة حية. أعطني دقائق وأمشيك عبر الخريطة والعصور والنكهات.'
      )
    },
    {
      id: 'atlas',
      anchor: 'irMap',
      spotlight: '#irMap',
      action: 'openAtlas',
      durationMs: 7000,
      kicker: b('Atlas', 'أطلس'),
      title: b('The map opens', 'تُفتح الخريطة'),
      copy: b('Caspian green, desert brick, Gulf heat — every pin a place you can stand.', 'خضرة قزوين وطوب الصحراء وحر الخليج — كل علامة مكان يمكنك الوقوف فيه.'),
      narration: b(
        'First, the atlas. From Tehran to Bandar Abbas, from Persepolis stone to Rasht’s rainy kitchens — history pins, food towns, and living places. Select a name and the map leans in.',
        'أولاً الأطلس. من طهران إلى بندر عباس، من حجر برسبوليس إلى مطابخ رشت الممطرة — علامات تاريخ وبلدات طعام وأماكن حيّة. اختر اسماً فتميل الخريطة نحوه.'
      )
    },
    {
      id: 'tehran',
      anchor: 'irMap',
      spotlight: '#irMapCanvas',
      action: 'focusTehran',
      durationMs: 8200,
      kicker: b('Capital', 'العاصمة'),
      title: b('Tehran', 'طهران'),
      copy: b('Alborz backdrop and modern Iran’s crowded heart.', 'خلفية البرز وقلب إيران الحديثة المزدحم.'),
      narration: b(
        'Start in Tehran. Qajar kings made it capital; today it sprawls under the Alborz with museums, traffic, and kitchens that still argue about the best chelo kebab.',
        'نبدأ من طهران. جعلها ملوك القاجار عاصمة؛ واليوم تمتد تحت البرز بمتاحف وزحمة ومطابخ ما زالت تتجادل حول أفضل تشيلو كباب.'
      )
    },
    {
      id: 'isfahan',
      anchor: 'irMap',
      spotlight: '#irMapCanvas',
      action: 'focusIsfahan',
      durationMs: 7800,
      kicker: b('Safavid jewel', 'جوهرة صفوية'),
      title: b('Isfahan', 'أصفهان'),
      copy: b('Blue tiles, bridges, and Naqsh-e Jahan.', 'بلاط أزرق وجسور ونقش جهان.'),
      narration: b(
        'Then Isfahan — half the world, the proverb says. Shah Abbas shaped the square; bridges still hold evening tea and song.',
        'ثم أصفهان — نصف العالم كما يقول المثل. شكّل الشاه عباس الساحة؛ وما زالت الجسور تحمل شاي المساء والغناء.'
      )
    },
    {
      id: 'persepolis',
      anchor: 'irMap',
      spotlight: '#irMapCanvas',
      action: 'focusPersepolis',
      durationMs: 8000,
      kicker: b('Stone memory', 'ذاكرة حجر'),
      title: b('Persepolis', 'برسبوليس'),
      copy: b('Achaemenid stairs where nations once climbed.', 'أدراج أخمينية صعدتها الأمم يوماً.'),
      narration: b(
        'South to Persepolis. Darius built a ceremonial capital of reliefs and columns. The stairs still teach how empire wanted to be seen.',
        'جنوباً إلى برسبوليس. بنى داريوس عاصمة احتفالية من نقوش وأعمدة. ما زالت الأدراج تعلّم كيف أرادت الإمبراطورية أن تُرى.'
      )
    },
    {
      id: 'eras',
      anchor: 'irTimeline',
      spotlight: '#irTimeline',
      action: 'openFirstEra',
      durationMs: 7500,
      kicker: b('Timeline', 'خط زمني'),
      title: b('Eras of Iran', 'عصور إيران'),
      copy: b('Elam to today — select a layer to hear it.', 'من عيلام إلى اليوم — اختر طبقة لتسمعها.'),
      narration: b(
        'Open the timeline. Elam, Achaemenids, Sasanians, Islamic Persian revival, Safavids, Qajars, Pahlavis, and the Islamic Republic — each layer has a place on the map.',
        'افتح الخط الزمني. عيلام والأخمينيون والساسانيون والنهضة الفارسية الإسلامية والصفويون والقاجار والبهلويون والجمهورية الإسلامية — لكل طبقة مكان على الخريطة.'
      )
    },
    {
      id: 'food',
      anchor: 'irFood',
      spotlight: '#irFoodGrid',
      action: 'flipFirstFood',
      durationMs: 7200,
      kicker: b('Table', 'مائدة'),
      title: b('Kebab and tahdig', 'كباب وتهديغ'),
      copy: b('Flip a plate — herb stews, jeweled rice, and sangak.', 'اقلب طبقاً — يخنة أعشاب وأرز مرصّع وسنگک.'),
      narration: b(
        'At the table, chelo kebab meets ghormeh sabzi, fesenjan darkens with walnut, and tahdig cracks like treasure. Flip a card and I will tell you why patience tastes like hospitality here.',
        'على المائدة يلتقي تشيلو كباب بقورمه سبزي، ويغمق الفسنجان بالجوز، ويتشقق التهديغ ككنز. اقلب بطاقة وأخبرك لماذا يذوق الصبر كضيافة هنا.'
      )
    },
    {
      id: 'music',
      anchor: 'irMusic',
      spotlight: '#irMusicGrid',
      action: 'flipFirstMusic',
      durationMs: 7000,
      kicker: b('Sound', 'صوت'),
      title: b('Tar and radif', 'تار ورديف'),
      copy: b('Lutes, frame drums, and living modes.', 'أعواد ودفوف ومقامات حية.'),
      narration: b(
        'Listen for tar and setar, daf circles, Kurdish folk, and the radif that pupils still memorize. Flip a music card for the history behind the mode.',
        'اسمع التار والسه‌تار وحلقات الدف والأغنية الكردية والرديف الذي ما زال التلاميذ يحفظونه. اقلب بطاقة موسيقى لتقرأ الحكاية خلف المقام.'
      )
    },
    {
      id: 'majlis',
      anchor: 'irHookah',
      spotlight: '#irHookahGrid',
      action: 'flipFirstHookah',
      durationMs: 6800,
      kicker: b('Café', 'مقهى'),
      title: b('Chai before smoke', 'شاي قبل الدخان'),
      copy: b('Qahveh-khaneh talk — then slow qalyān.', 'حديث القهوه‌خانه — ثم قلیان بطيء.'),
      narration: b(
        'In the café, chai comes first. Storytellers once filled the qahveh-khaneh; today tea and talk still outlast the coals.',
        'في المقهى يأتي الشاي أولاً. ملأ الحكّاؤون القهوه‌خانه يوماً؛ واليوم ما زال الشاي والحديث أطول عمراً من الجمر.'
      )
    },
    {
      id: 'living',
      anchor: 'irLiving',
      spotlight: '#irLivingGrid',
      action: 'flipFirstLiving',
      durationMs: 7200,
      kicker: b('Living', 'حياة'),
      title: b('Nowruz and carpets', 'نوروز وسجاد'),
      copy: b('Fire nights, bazaars, and taarof courtesy.', 'ليالي نار وأسواق وآداب التعارف.'),
      narration: b(
        'Living culture is Nowruz and Chaharshanbe Suri fire, knotted carpets, bazaar vaults, calligraphy, and taarof. These are not museum labels — they still organize the year.',
        'الثقافة الحيّة هي نوروز ونار چهارشنبه‌سوری، والسجاد المعقود، وأقواس البازار، والخط، والتعارف. هذه ليست بطاقات متحف — ما زالت تنظّم السنة.'
      )
    },
    {
      id: 'phrases',
      anchor: 'irPhrases',
      spotlight: '#irPhraseList',
      action: 'speakFirstPhrase',
      durationMs: 6500,
      kicker: b('Speak', 'تكلّم'),
      title: b('Ahlan wa sahlan', 'أهلاً وسهلاً'),
      copy: b('Press a phrase — I will say it aloud.', 'اضغط عبارة — سأقولها بصوت عالٍ.'),
      narration: b(
        'Before you go, take a greeting. Ahlan wa sahlan. Press any phrase on the page and I will say it for you in everyday Arabic.',
        'قبل أن تمضي، خذ تحية. أهلاً وسهلاً. اضغط أي عبارة في الصفحة وسأقولها لك بعربية يومية.'
      )
    },
    {
      id: 'close',
      anchor: 'irGuide',
      spotlight: '#irGuide',
      action: 'unflipCards',
      durationMs: 7000,
      kicker: b('Ask me', 'اسألني'),
      title: b('I am still here', 'ما زلت هنا'),
      copy: b('Ask Nima about Persepolis, tahdig, or Nowruz.', 'اسأل نیما عن برسبوليس أو التهديغ أو نوروز.'),
      narration: b(
        'That is the tour. Stay on the map, flip more cards, or ask me anything — Persepolis stairs, Isfahan bridges, ghormeh sabzi, or the fires of Nowruz. Khoda hafez for now, and welcome whenever you return.',
        'هذه هي الجولة. ابقَ على الخريطة، أو اقلب مزيداً من البطاقات، أو اسألني أي شيء — أدراج برسبوليس، وجسور أصفهان، وقورمه سبزي، أو نيران نوروز. خدا حافظ الآن، وأهلاً بك كلما عدت.'
      )
    }
  ]
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, 'iran-content.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8');
writeFileSync(path.join(OUT_DIR, 'iran-story-reel.json'), `${JSON.stringify(reel, null, 2)}\n`, 'utf8');
console.log(`Wrote iran-content.json (${content.eras.length} eras, ${content.sites.length} sites) and iran-story-reel.json (${reel.scenes.length} scenes)`);
