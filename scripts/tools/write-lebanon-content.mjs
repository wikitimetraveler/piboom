#!/usr/bin/env node
/**
 * Write full bilingual Lebanon atlas content + story reel JSON.
 *   node scripts/tools/write-lebanon-content.mjs
 * Development work by David Lane
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public/lebanon/data');

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
  id: 'lebanon-atlas',
  brand: {
    name: b('Lebanon — Cedars and Coasts', 'لبنان — أرز وسواحل'),
    tagline: b(
      'From Phoenician harbors to cedar mountains — history, mezze, and song on the Levantine shore.',
      'من الموانئ الفينيقية إلى جبال الأرز — تاريخ ومزة وغناء على الساحل المشرقي.'
    )
  },
  guide: {
    name: b('Karim', 'كريم'),
    title: b('Lebanon history guide', 'دليل تاريخ لبنان'),
    portrait: '/lebanon/assets/karim-guide-portrait-256.png',
    greeting: b(
      'Ahlan wa sahlan. I am Karim — walk with me from Beirut to Byblos and Baalbek.',
      'أهلاً وسهلاً. أنا كريم — امشِ معي من بيروت إلى جبيل وبعلبك.'
    )
  },
  ui: {
    en: {
      dir: 'ltr',
      langLabel: 'English',
      switchTo: 'عربي',
      heroKicker: 'Cedars and Coasts',
      heroTitle: 'Lebanon',
      heroLine:
        'A mountain-backed Mediterranean shore — Phoenician harbors, Roman temples, cedar groves, and a living table of mezze, Fairuz, and café talk.',
      playReel: 'Play HyperFrame tour',
      pauseReel: 'Pause tour',
      resumeReel: 'Resume tour',
      stopReel: 'Stop tour',
      narration: 'Narration',
      narrationScope: 'Entire page — atlas, tour, and cards',
      hearWelcome: 'Hear welcome',
      askGuide: 'Ask Karim',
      stop: 'Stop',
      listen: 'Listen',
      exploreMap: 'Explore the atlas',
      timelineHeading: 'Eras of Lebanon',
      timelineLead:
        'From Phoenician Byblos to contemporary Beirut. Select an era to hear it and find it on the map.',
      timelineSelectHint: 'Select an era on the timeline',
      mapHeading: 'Atlas of Lebanon',
      mapLead: 'Coast, mountain, and Bekaa plain. Select a pin or a name to hear its story.',
      mapAll: 'All',
      mapHistory: 'History',
      mapFood: 'Food',
      mapMusic: 'Music',
      mapHookah: 'Café',
      mapLiving: 'Living',
      mapReset: 'Show all pins',
      mapLoading: 'Loading the atlas…',
      foodHeading: 'The Lebanese table',
      foodLead: 'Tabbouleh, kibbeh, manakish, and knafeh — flip a dish for its origin and meaning.',
      musicHeading: 'Sound of Lebanon',
      musicLead: 'Fairuz, dabke, oud, and the Rahbani stage. Flip a card for the history.',
      hookahHeading: 'Café — tea, coffee, and slow talk',
      hookahLead: 'Nargileh, café tables, and evening conversation — Beirut and Tripoli as social furniture.',
      livingHeading: 'Living cultures',
      livingLead: 'Cedars, diaspora ties, calligraphy, village life, and Mediterranean coasts.',
      phraseHeading: 'Speak Lebanese',
      phraseLead: 'Everyday Levantine Arabic greetings heard across Lebanon. Press any phrase to hear it.',
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
      meetGuide: 'Meet Karim'
    },
    ar: {
      dir: 'rtl',
      langLabel: 'العربية',
      switchTo: 'English',
      heroKicker: 'أرز وسواحل',
      heroTitle: 'لبنان',
      heroLine:
        'ساحل متوسطي خلفه جبال — موانئ فينيقية ومعابد رومانية وأرز، ومائدة حية من المزة وفيروز وحديث المقهى.',
      playReel: 'شغّل الجولة',
      pauseReel: 'إيقاف مؤقت',
      resumeReel: 'متابعة الجولة',
      stopReel: 'إنهاء الجولة',
      narration: 'السرد الصوتي',
      narrationScope: 'الصفحة كاملة — الأطلس والجولة والبطاقات',
      hearWelcome: 'استمع للترحيب',
      askGuide: 'اسأل كريم',
      stop: 'إيقاف',
      listen: 'استمع',
      exploreMap: 'استكشف الأطلس',
      timelineHeading: 'عصور لبنان',
      timelineLead: 'من جبيل الفينيقية إلى بيروت المعاصرة. اختر حقبة لتسمعها وتجدها على الخريطة.',
      timelineSelectHint: 'اختر حقبة من الخط الزمني',
      mapHeading: 'أطلس لبنان',
      mapLead: 'ساحل وجبل وسهل البقاع. اختر علامة أو اسماً لتسمع حكايته.',
      mapAll: 'الكل',
      mapHistory: 'تاريخ',
      mapFood: 'طعام',
      mapMusic: 'موسيقى',
      mapHookah: 'مقهى',
      mapLiving: 'حياة',
      mapReset: 'أظهر كل العلامات',
      mapLoading: 'جارٍ تحميل الأطلس…',
      foodHeading: 'المائدة اللبنانية',
      foodLead: 'تبولة وكبة ومناقيش وكنافة — اقلب الطبق لتعرف أصله ومعناه.',
      musicHeading: 'صوت لبنان',
      musicLead: 'فيروز والدبكة والعود ومسرح الرحباني. اقلب البطاقة لتقرأ الحكاية.',
      hookahHeading: 'المقهى — شاي وقهوة وحديث بطيء',
      hookahLead: 'نرجيلة وطاولات مقهى وحديث المساء — بيروت وطرابلس كأثاث اجتماعي.',
      livingHeading: 'ثقافات حيّة',
      livingLead: 'أرز وشتات وخط وقرية وسواحل متوسطية.',
      phraseHeading: 'احكِ لبناني',
      phraseLead: 'تحيات عربية شامية يومية تُسمَع في لبنان. اضغط أي عبارة لتسمعها.',
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
      meetGuide: 'تعرّف على كريم'
    }
  },
  eras: [
    {
      id: 'phoenician',
      siteId: 'byblos',
      yearCE: -1200,
      years: b('c. 1500–300 BCE', 'نحو ١٥٠٠–٣٠٠ ق.م'),
      title: b('Phoenician — cedar and alphabet', 'فينيقيا — أرز وأبجدية'),
      copy: b('Harbor cities that sailed cedar and letters across the Mediterranean.', 'مدن موانئ أبحرت بالأرز والحروف عبر المتوسط.'),
      narration: b(
        'We begin with the Phoenicians. Byblos, Tyre, and Sidon sent cedar, purple dye, and an alphabet that reshaped the Mediterranean. Their ships made this narrow coast a bridge between worlds.',
        'نبدأ بالفينيقيين. أرسلت جبيل وصور وصيدا الأرز والأرجوان وأبجدية أعادت تشكيل المتوسط. جعلت سفنهم هذا الساحل الضيق جسراً بين العوالم.'
      ),
      history: b(
        'Phoenician city-states along the Lebanese coast built maritime trade networks from the Levant to North Africa and Iberia. Cedar timber, glass, and Tyrian purple were signature exports. The linear alphabet associated with Phoenician writing later influenced Greek and Latin scripts. Archaeology at Byblos, Tyre, and Sidon anchors that coastal story.',
        'بنت دويلات المدن الفينيقية على الساحل اللبناني شبكات تجارة بحرية من المشرق إلى شمال أفريقيا وإيبيريا. كان خشب الأرز والزجاج والأرجوان الصوري من أبرز الصادرات. وأثّرت الأبجدية المرتبطة بالكتابة الفينيقية لاحقاً في اليونانية واللاتينية. يرسّخ علم الآثار في جبيل وصور وصيدا هذه الحكاية الساحلية.'
      ),
      image: '/lebanon/assets/era/phoenician.jpg'
    },
    {
      id: 'roman',
      siteId: 'baalbek',
      yearCE: 150,
      years: b('64 BCE–395 CE', '٦٤ ق.م–٣٩٥ م'),
      title: b('Roman — temples of Heliopolis', 'روماني — معابد هليوبوليس'),
      copy: b('Baalbek’s colossal stones and coastal cities under Rome.', 'حجارة بعلبك الهائلة ومدن الساحل تحت روما.'),
      narration: b(
        'Next, Rome. At Baalbek the empire raised temples of astonishing scale. Coastal cities became Roman, then late antique, while mountain valleys kept their own rhythms.',
        'ثم روما. في بعلبك رفعت الإمبراطورية معابد بمقياس مذهل. صارت مدن الساحل رومانية ثم متأخرة عتيقة، بينما احتفظت أودية الجبل بإيقاعاتها.'
      ),
      history: b(
        'After Pompey’s settlement of the East, coastal Phoenicia entered the Roman orbit. Heliopolis (Baalbek) received monumental temple building that still defines the Bekaa skyline. Roman roads, law, and urban institutions layered over older harbor traditions without erasing them.',
        'بعد تسوية بومبيوس للشرق دخلت فينيقيا الساحلية مدار روما. تلقّت هليوبوليس (بعلبك) بناء معابد ضخماً ما زال يحدّد أفق البقاع. رصفت الطرق الرومانية والقانون والمؤسسات الحضرية فوق تقاليد الموانئ الأقدم دون محوها.'
      ),
      image: '/lebanon/assets/era/roman.jpg'
    },
    {
      id: 'byzantine-islamic',
      siteId: 'aanjar',
      yearCE: 700,
      years: b('c. 395–1100 CE', 'نحو ٣٩٥–١١٠٠ م'),
      title: b('Byzantine & early Islamic', 'بيزنطي وإسلامي مبكر'),
      copy: b('From Christian Levantine towns to Umayyad Aanjar.', 'من بلدات مسيحية مشرقية إلى عنجر الأموي.'),
      narration: b(
        'Byzantine churches and monasteries marked the mountains. Then early Islam arrived — Aanjar’s Umayyad plan still shows how a new capital form was set in the Bekaa.',
        'وسمت الكنائس والأديرة البيزنطية الجبال. ثم وصل الإسلام المبكر — ما زال مخطط عنجر الأموي يُظهر كيف وُضعت عاصمة جديدة في البقاع.'
      ),
      history: b(
        'Late antiquity saw Christian communities flourish in the Lebanese mountains and valleys, including the Qadisha region’s monastic landscape. The Arab-Islamic conquests of the seventh century brought new administration; the Umayyad city of Aanjar preserves a planned urban grid from that early Islamic century.',
        'شهدت العصور المتأخرة ازدهار جماعات مسيحية في جبال لبنان وأوديته، بما فيها مشهد الرهبنة في قاديشا. جلبت الفتوح العربية الإسلامية في القرن السابع إدارة جديدة؛ وتحفظ عنجر الأموية شبكة حضرية مخططة من ذلك القرن الإسلامي المبكر.'
      ),
      image: '/lebanon/assets/era/byzantine-islamic.jpg'
    },
    {
      id: 'crusader',
      siteId: 'tripoli',
      yearCE: 1180,
      years: b('1099–1291 CE', '١٠٩٩–١٢٩١ م'),
      title: b('Crusader — castles and ports', 'صليبي — قلاع وموانئ'),
      copy: b('Frankish counties, coastal castles, and contested harbors.', 'كونتيّات فرنجية وقلاع ساحلية وموانئ متنازع عليها.'),
      narration: b(
        'Crusader centuries left castles above Tripoli and Byblos. Ports changed hands; mountain communities negotiated survival between Frankish, Ayyubid, and Mamluk powers.',
        'تركت القرون الصليبية قلاعاً فوق طرابلس وجبيل. تبدّلت أيدي الموانئ؛ وتفاوضت جماعات الجبل على البقاء بين قوى فرنجية وأيوبية ومملوكية.'
      ),
      history: b(
        'The County of Tripoli and coastal strongholds formed part of the Crusader states. Castles and harbor works at Tripoli, Sidon, and Byblos record that military-commercial presence. Mamluk reconquest in the late thirteenth century ended Frankish rule on this coast.',
        'شكّلت كونتية طرابلس والمعاقل الساحلية جزءاً من الدول الصليبية. تسجّل القلاع وأعمال الموانئ في طرابلس وصيدا وجبيل ذلك الحضور العسكري التجاري. وأنهى الاسترداد المملوكي في أواخر القرن الثالث عشر الحكم الفرنجي على هذا الساحل.'
      ),
      image: '/lebanon/assets/era/crusader.jpg'
    },
    {
      id: 'ottoman',
      siteId: 'beiteddine',
      yearCE: 1800,
      years: b('1516–1918', '١٥١٦–١٩١٨'),
      title: b('Ottoman — emirates and silk', 'عثماني — إمارات وحرير'),
      copy: b('Mountain emirates, Beiteddine Palace, and Mediterranean trade.', 'إمارات جبلية وقصر بيت الدين وتجارة المتوسط.'),
      narration: b(
        'Under the Ottomans, mountain emirates and coastal cities shared one empire. Beiteddine Palace still shows how local power dressed itself in stone and courtyard light.',
        'تحت العثمانيين شاركت إمارات الجبل ومدن الساحل إمبراطورية واحدة. ما زال قصر بيت الدين يُظهر كيف ارتدت السلطة المحلية حجراً وضوء باحات.'
      ),
      history: b(
        'Ottoman rule after 1516 nested local dynasties — notably in Mount Lebanon — within imperial administration. Silk, ports, and mountain agriculture linked the coast to inland valleys. Beiteddine Palace, built under the Chehab emirs, remains a landmark of that layered authority.',
        'أعششت الإدارة العثمانية بعد ١٥١٦ سلالات محلية — خصوصاً في جبل لبنان — داخل الإدارة الإمبراطورية. ربط الحرير والموانئ وزراعة الجبل الساحل بأودية الداخل. ويبقى قصر بيت الدين، الذي بُني في عهد الأمراء الشهابيين، معلماً لتلك السلطة المتراكبة.'
      ),
      image: '/lebanon/assets/era/ottoman.jpg'
    },
    {
      id: 'mandate',
      siteId: 'beirut',
      yearCE: 1925,
      years: b('1920–1943', '١٩٢٠–١٩٤٣'),
      title: b('Mandate — Greater Lebanon', 'الانتداب — لبنان الكبير'),
      copy: b('French mandate borders and a capital remade as Beirut.', 'حدود الانتداب الفرنسي وعاصمة أُعيد تشكيلها كبيروت.'),
      narration: b(
        'After World War I the French mandate drew Greater Lebanon. Beirut grew as capital, press, and university city — a modern shoreline with older mountains behind it.',
        'بعد الحرب العالمية الأولى رسم الانتداب الفرنسي لبنان الكبير. نمت بيروت كعاصمة وصحافة وجامعة — شاطئ حديث وخلفه جبال أقدم.'
      ),
      history: b(
        'The State of Greater Lebanon was proclaimed in 1920 under French mandate, assembling coastal cities with Mount Lebanon and the Bekaa. Beirut’s port, schools, and newspapers expanded. Independence movements gathered force through the 1930s and early 1940s.',
        'أُعلن دولة لبنان الكبير سنة ١٩٢٠ تحت الانتداب الفرنسي، جامعاً مدن الساحل مع جبل لبنان والبقاع. توسّع ميناء بيروت ومدارسها وصحفها. وتجمّعت حركات الاستقلال عبر الثلاثينيات وأوائل الأربعينيات.'
      ),
      image: '/lebanon/assets/era/mandate.jpg'
    },
    {
      id: 'independence',
      siteId: 'beirut',
      yearCE: 1943,
      years: b('1943–1975', '١٩٤٣–١٩٧٥'),
      title: b('Independence — republic years', 'الاستقلال — سنوات الجمهورية'),
      copy: b('A young republic, banking coast, and cultural capital.', 'جمهورية فتية وساحل مصرفي وعاصمة ثقافية.'),
      narration: b(
        'Independence in 1943 opened republic decades. Beirut became a regional hub of publishing, music, and finance — Fairuz and the Rahbanis among its most famous voices.',
        'فتح الاستقلال سنة ١٩٤٣ عقود الجمهورية. صارت بيروت مركزاً إقليمياً للنشر والموسيقى والمال — وفيروز والرحابنة من أشهر أصواتها.'
      ),
      history: b(
        'Lebanon’s independence is conventionally dated to 1943. Mid-century Beirut attracted regional capital, universities, and arts scenes. Tourism and banking grew alongside village and mountain economies. The civil war that began in 1975 interrupted that chapter.',
        'يُؤرَّخ استقلال لبنان عادةً بسنة ١٩٤٣. جذبت بيروت منتصف القرن رأس المال الإقليمي والجامعات ومشاهد الفنون. ونما السياحة والمصارف إلى جانب اقتصاد القرية والجبل. وأوقفت الحرب الأهلية التي بدأت سنة ١٩٧٥ ذلك الفصل.'
      ),
      image: '/lebanon/assets/era/independence.jpg'
    },
    {
      id: 'contemporary',
      siteId: 'beirut',
      yearCE: 2000,
      years: b('1975–today', '١٩٧٥–اليوم'),
      title: b('Contemporary Lebanon', 'لبنان المعاصر'),
      copy: b('War, recovery, diaspora, and a living culture that still sings.', 'حرب وتعافٍ وشتات وثقافة حيّة ما زالت تغني.'),
      narration: b(
        'Contemporary Lebanon carries war memory, rebuilding, and a vast diaspora. Cedars still stand in the mountains; mezze and Fairuz still travel the world with Lebanese names.',
        'يحمل لبنان المعاصر ذاكرة الحرب وإعادة البناء وشتاتاً واسعاً. ما زال الأرز في الجبال؛ وما زالت المزة وفيروز تسافران مع الأسماء اللبنانية.'
      ),
      history: b(
        'Civil war (1975–1990), occupation periods, and later crises reshaped politics and cities. Cultural continuity — cuisine, music, calligraphy, village festivals, and cedar symbolism — remains central to how Lebanon presents itself at home and abroad. This atlas focuses on that cultural ground.',
        'أعادت الحرب الأهلية (١٩٧٥–١٩٩٠) وفترات الاحتلال والأزمات اللاحقة تشكيل السياسة والمدن. ويبقى الاستمرار الثقافي — المطبخ والموسيقى والخط ومهرجانات القرية ورمز الأرز — محورياً في صورة لبنان في الداخل والخارج. يركّز هذا الأطلس على تلك الأرضية الثقافية.'
      ),
      image: '/lebanon/assets/era/contemporary.jpg'
    }
  ],
  sites: [
    {
      id: 'beirut',
      category: 'history',
      emoji: '🏙️',
      lat: 33.8938,
      lng: 35.5018,
      unesco: false,
      name: b('Beirut', 'بيروت'),
      place: b('Capital on the Mediterranean', 'العاصمة على المتوسط'),
      blurb: b(
        'Lebanon’s capital — port, universities, cafés, and layers of recovery and memory.',
        'عاصمة لبنان — ميناء وجامعات ومقاهٍ وطبقات تعافٍ وذاكرة.'
      )
    },
    {
      id: 'byblos',
      category: 'history',
      emoji: '⚓',
      lat: 34.1211,
      lng: 35.6481,
      unesco: true,
      name: b('Byblos', 'جبيل'),
      place: b('UNESCO harbor city', 'مدينة ميناء مدرجة في اليونسكو'),
      blurb: b(
        'One of the oldest continuously inhabited cities — Phoenician harbor, crusader castle, and old souk.',
        'من أقدم المدن المأهولة باستمرار — ميناء فينيقي وقلعة صليبية وسوق قديم.'
      )
    },
    {
      id: 'baalbek',
      category: 'history',
      emoji: '🏛️',
      lat: 34.0069,
      lng: 36.2039,
      unesco: true,
      name: b('Baalbek', 'بعلبك'),
      place: b('Bekaa — Roman temples', 'البقاع — معابد رومانية'),
      blurb: b(
        'Colossal temple complex of Heliopolis — among the grandest Roman ruins in the Levant.',
        'مجمع معابد هليوبوليس الهائل — من أعظم الآثار الرومانية في المشرق.'
      )
    },
    {
      id: 'tyre',
      category: 'history',
      emoji: '🏺',
      lat: 33.2704,
      lng: 35.2038,
      unesco: true,
      name: b('Tyre', 'صور'),
      place: b('Southern coastal city', 'مدينة ساحلية جنوبية'),
      blurb: b(
        'Phoenician island-city later joined to the mainland — purple dye, Roman hippodrome, and sea walls.',
        'مدينة فينيقية جزيرية اتصلت لاحقاً بالبر — أرجوان وحلبة رومانية وأسوار بحر.'
      )
    },
    {
      id: 'sidon',
      category: 'history',
      emoji: '🏰',
      lat: 33.5631,
      lng: 35.3689,
      unesco: false,
      name: b('Sidon', 'صيدا'),
      place: b('Sea Castle and old town', 'قلعة البحر والمدينة القديمة'),
      blurb: b(
        'Ancient Sidon — crusader Sea Castle, soap souks, and a working harbor.',
        'صيدا القديمة — قلعة البحر الصليبية وأسواق الصابون وميناء عامل.'
      )
    },
    {
      id: 'tripoli',
      category: 'history',
      emoji: '🕌',
      lat: 34.4367,
      lng: 35.8497,
      unesco: false,
      name: b('Tripoli', 'طرابلس'),
      place: b('Northern capital of memory', 'عاصمة الشمال في الذاكرة'),
      blurb: b(
        'Mamluk mosques, crusader citadel, and a dense old city of sweets and souks.',
        'مساجد مملوكية وقلعة صليبية ومدينة قديمة كثيفة بالحلويات والأسواق.'
      )
    },
    {
      id: 'beiteddine',
      category: 'living',
      emoji: '🏯',
      lat: 33.6961,
      lng: 35.5794,
      unesco: false,
      name: b('Beiteddine', 'بيت الدين'),
      place: b('Chouf — palace town', 'الشوف — بلدة القصر'),
      blurb: b(
        'Ottoman-era palace of courtyards and carved stone — summer festivals still gather here.',
        'قصر عثماني الطابع بباحات وحجر منحوت — ما زالت مهرجانات الصيف تتجمع هنا.'
      )
    },
    {
      id: 'cedars',
      category: 'living',
      emoji: '🌲',
      lat: 34.2436,
      lng: 36.0408,
      unesco: true,
      name: b('Cedars of God', 'أرز الرب'),
      place: b('Bsharri — mountain grove', 'بشري — حرش جبلي'),
      blurb: b(
        'Ancient Cedrus libani grove — national emblem and UNESCO forest landscape.',
        'حرش أرز لبناني عتيق — شعار وطني ومشهد غابي مدرج في اليونسكو.'
      )
    },
    {
      id: 'aanjar',
      category: 'history',
      emoji: '🧱',
      lat: 33.7339,
      lng: 35.9336,
      unesco: true,
      name: b('Aanjar', 'عنجر'),
      place: b('Bekaa — Umayyad city', 'البقاع — مدينة أموية'),
      blurb: b(
        'Planned early Islamic city with colonnades and a clear urban grid.',
        'مدينة إسلامية مبكرة مخططة بأروقة وشبكة حضرية واضحة.'
      )
    },
    {
      id: 'jeita',
      category: 'living',
      emoji: '🕳️',
      lat: 33.9436,
      lng: 35.6417,
      unesco: false,
      name: b('Jeita Grotto', 'مغارة جعيتا'),
      place: b('Keserwan — limestone caves', 'كسروان — كهوف كلسية'),
      blurb: b(
        'Spectacular karst caves with underground river — one of Lebanon’s natural landmarks.',
        'كهوف كارستية مذهلة بنهر جوفي — من معالم لبنان الطبيعية.'
      )
    },
    {
      id: 'qadisha',
      category: 'living',
      emoji: '⛪',
      lat: 34.2833,
      lng: 35.95,
      unesco: true,
      name: b('Qadisha Valley', 'وادي قاديشا'),
      place: b('North — holy valley', 'الشمال — الوادي المقدس'),
      blurb: b(
        'Deep valley of Maronite monasteries carved into cliffs — paired with the Cedars in UNESCO listing.',
        'وادٍ عميق لأديرة مارونية محفورة في الجروف — مقترن بالأرز في قائمة اليونسكو.'
      )
    },
    {
      id: 'zahle',
      category: 'food',
      emoji: '🍷',
      lat: 33.8467,
      lng: 35.9022,
      unesco: false,
      name: b('Zahle', 'زحلة'),
      place: b('Bekaa — city of wine and mezze', 'البقاع — مدينة النبيذ والمزة'),
      blurb: b(
        'Riverside restaurants, arak, and vineyard country at the foot of the mountains.',
        'مطاعم على النهر وعرق وبلاد كروم عند سفح الجبال.'
      )
    },
    {
      id: 'beirut-music',
      category: 'music',
      emoji: '🎵',
      lat: 33.8886,
      lng: 35.4955,
      unesco: false,
      name: b('Beirut stages', 'مسارح بيروت'),
      place: b('Hamra & downtown memory', 'حمرا وذاكرة الوسط'),
      blurb: b(
        'Where Fairuz, the Rahbanis, and later indie scenes found stages and radio.',
        'حيث وجدت فيروز والرحابنة ثم مشاهد الإندي مسارح ومذياعاً.'
      )
    },
    {
      id: 'beirut-cafe',
      category: 'living',
      emoji: '☕',
      lat: 33.8992,
      lng: 35.4814,
      unesco: false,
      name: b('Beirut cafés', 'مقاهي بيروت'),
      place: b('Corniche & neighborhood tables', 'الكورنيش وطاولات الأحياء'),
      blurb: b(
        'Coffee, nargileh, and long talk — the city’s social living room.',
        'قهوة ونرجيلة وحديث طويل — غرفة جلوس المدينة الاجتماعية.'
      )
    }
  ],
  foods: [
    {
      id: 'tabbouleh',
      emoji: '🥗',
      siteId: 'zahle',
      name: b('Tabbouleh', 'تبولة'),
      tagline: b('Parsley salad of lemon and bulgur', 'سلطة بقدونس بليمون وبرغل'),
      history: b(
        'Tabbouleh is Lebanon’s green signature — finely chopped parsley with tomato, mint, bulgur, lemon, and olive oil. Villages and city tables alike treat it as mezze pride, not a side afterthought.',
        'التبولة توقيع لبنان الأخضر — بقدونس مفروم ناعماً مع بندورة ونعناع وبرغل وليمون وزيت زيتون. تعاملها القرى وموائد المدينة كفخر مزة لا كطبق جانبي.'
      ),
      tags: tags(['Mezze', 'Parsley', 'Lemon'], ['مزة', 'بقدونس', 'ليمون']),
      image: '/lebanon/assets/food/tabbouleh.jpg'
    },
    {
      id: 'kibbeh',
      emoji: '🥙',
      siteId: 'zahle',
      name: b('Kibbeh', 'كبة'),
      tagline: b('Bulgur and meat — raw, fried, or baked', 'برغل ولحم — نيئة أو مقلية أو بالصينية'),
      history: b(
        'Kibbeh takes many forms: kibbeh nayyeh as festive raw dish, fried balls, or tray-baked kibbeh bil saniyeh. The blend of bulgur and meat is a mountain-and-Bekaa classic.',
        'للكبة صور كثيرة: كبة نيئة في الأعياد، أو كرات مقلية، أو كبة بالصينية. ومزج البرغل واللحم كلاسيكية جبل وبقاع.'
      ),
      tags: tags(['Mezze', 'Bulgur', 'Meat'], ['مزة', 'برغل', 'لحم']),
      image: '/lebanon/assets/food/kibbeh.jpg'
    },
    {
      id: 'manakish',
      emoji: '🫓',
      siteId: 'beirut',
      name: b('Manakish', 'مناقيش'),
      tagline: b('Morning flatbread with zaʿatar or cheese', 'خبز الصباح بزعتر أو جبنة'),
      history: b(
        'Bakeries pull manakish from stone ovens at breakfast — zaʿatar oil, cheese, or minced meat. It is street fuel and family ritual from Beirut to mountain towns.',
        'تسحب المخابز المناقيش من الأفران الحجرية في الإفطار — زيت زعتر أو جبنة أو لحم مفروم. هي وقود الشارع وطقس العائلة من بيروت إلى بلدات الجبل.'
      ),
      tags: tags(['Breakfast', 'Zaatar', 'Bakery'], ['فطور', 'زعتر', 'مخبز']),
      image: '/lebanon/assets/food/manakish.jpg'
    },
    {
      id: 'fattoush',
      emoji: '🥬',
      siteId: 'beirut',
      name: b('Fattoush', 'فتوش'),
      tagline: b('Bread salad bright with sumac', 'سلطة خبز مشرقة بالسماق'),
      history: b(
        'Fattoush tosses garden vegetables with toasted pita and a sharp sumac dressing. It is the crunchy twin of tabbouleh on many mezze spreads.',
        'يرمي الفتوش خضار البستان مع خبز محمّص وتتبيلة سماق حادة. هو التوأم المقرمش للتبولة على كثير من موائد المزة.'
      ),
      tags: tags(['Salad', 'Sumac', 'Pita'], ['سلطة', 'سماق', 'خبز']),
      image: '/lebanon/assets/food/fattoush.jpg'
    },
    {
      id: 'shawarma',
      emoji: '🌯',
      siteId: 'beirut',
      name: b('Shawarma', 'شاورما'),
      tagline: b('Spit-roasted street classic', 'كلاسيكية الشارع على السيخ'),
      history: b(
        'Vertical spits of seasoned meat carve into sandwiches with garlic sauce, pickles, and fries. Late-night Beirut and every highway stop tell the same story.',
        'تُقطع اللحوم المتبلة على السيخ العمودي في سندويشات مع ثوم ومخلل وبطاطا. تروي بيروت المتأخرة وكل موقف على الطريق الحكاية نفسها.'
      ),
      tags: tags(['Street', 'Sandwich', 'Garlic'], ['شارع', 'سندويش', 'ثوم']),
      image: '/lebanon/assets/food/shawarma.jpg'
    },
    {
      id: 'knafeh',
      emoji: '🍮',
      siteId: 'tripoli',
      name: b('Knafeh', 'كنافة'),
      tagline: b('Cheese pastry soaked in syrup', 'معجن جبن يُسقى بالقطر'),
      history: b(
        'Golden shredded pastry over soft cheese, finished with syrup and pistachios. Tripoli and coastal sweet shops treat knafeh as breakfast or celebration.',
        'عجينة مبشورة ذهبية فوق جبن طري، تُختَم بقطر وفستق. تعاملها طرابلس ومحلات الساحل كفطور أو احتفال.'
      ),
      tags: tags(['Sweet', 'Cheese', 'Syrup'], ['حلوى', 'جبن', 'قطر']),
      image: '/lebanon/assets/food/knafeh.jpg'
    },
    {
      id: 'mezze',
      emoji: '🍽️',
      siteId: 'zahle',
      name: b('Mezze', 'مزة'),
      tagline: b('A table of small plates and talk', 'مائدة صحون صغيرة وحديث'),
      history: b(
        'Mezze is hospitality as architecture — hummus, mutabbal, labneh, olives, and grilled meats arriving in waves. Zahle’s riverside tables made the form famous for visitors.',
        'المزة ضيافة كعمارة — حمص ومتبل ولبنة وزيتون ولحوم مشوية تصل موجات. جعلت طاولات زحلة على النهر الشكل مشهوراً للزوّار.'
      ),
      tags: tags(['Hospitality', 'Share', 'Table'], ['ضيافة', 'مشاركة', 'مائدة']),
      image: '/lebanon/assets/food/mezze.jpg'
    },
    {
      id: 'arak-table',
      emoji: '🥃',
      siteId: 'zahle',
      name: b('Arak table', 'طاولة عرق'),
      tagline: b('Anise spirit with mezze and grapes', 'روح اليانسون مع المزة والعنب'),
      history: b(
        'Arak — anise-flavored grape spirit — turns cloudy with water and ice. In the Bekaa it belongs with grilled meats, raw kibbeh, and long Sunday tables.',
        'العرق — روح عنب بيانسون — يتعكّر مع الماء والثلج. في البقاع ينتمي إلى اللحوم المشوية والكبة النيئة وطاولات الأحد الطويلة.'
      ),
      tags: tags(['Arak', 'Bekaa', 'Mezze'], ['عرق', 'بقاع', 'مزة']),
      image: '/lebanon/assets/food/arak-table.jpg'
    }
  ],
  music: [
    {
      id: 'fairuz',
      emoji: '🎤',
      siteId: 'beirut-music',
      name: b('Fairuz', 'فيروز'),
      tagline: b('The voice that carried Lebanon abroad', 'الصوت الذي حمل لبنان إلى الخارج'),
      history: b(
        'Fairuz’s songs — many written with the Rahbani brothers — became a shared soundtrack across the Arab world. Morning radio and diaspora kitchens still open with her voice.',
        'صارت أغاني فيروز — وكثير منها مع الأخوين رحباني — شريطاً صوتياً مشتركاً في العالم العربي. ما زالت إذاعة الصباح ومطابخ الشتات تُفتح بصوتها.'
      ),
      tags: tags(['Song', 'Radio', 'Icon'], ['أغنية', 'إذاعة', 'أيقونة']),
      image: '/lebanon/assets/music/fairuz.jpg'
    },
    {
      id: 'dabke',
      emoji: '💃',
      siteId: 'zahle',
      name: b('Dabke', 'دبكة'),
      tagline: b('Line dance of stomps and shoulder join', 'رقصة صف بخطوات وكتف متصل'),
      history: b(
        'Dabke joins weddings and village festivals — linked hands, stomping steps, and a leader who improvises the line. It is Levantine shared ground with Lebanese local styles.',
        'تجمع الدبكة الأعراس ومهرجانات القرية — أيدٍ متشابكة وخطوات دقّ وقائد يرتجل الصف. هي أرض شامية مشتركة بأساليب لبنانية محلية.'
      ),
      tags: tags(['Dance', 'Wedding', 'Village'], ['رقص', 'عرس', 'قرية']),
      image: '/lebanon/assets/music/dabke.jpg'
    },
    {
      id: 'oud-beirut',
      emoji: '🎶',
      siteId: 'beirut-music',
      name: b('Oud of Beirut', 'عود بيروت'),
      tagline: b('Lute nights in café and salon', 'ليالي عود في المقهى والصالون'),
      history: b(
        'The oud anchors tarab evenings and quiet salon sets. Beirut’s mid-century cafés and later clubs kept the instrument close to song and improvisation.',
        'يرسّخ العود أمسيات الطرب وجلسات الصالون الهادئة. أبقت مقاهي بيروت في منتصف القرن ثم الأندية الآلة قريبة من الغناء والارتجال.'
      ),
      tags: tags(['Oud', 'Tarab', 'Salon'], ['عود', 'طرب', 'صالون']),
      image: '/lebanon/assets/music/oud-beirut.jpg'
    },
    {
      id: 'rahbani',
      emoji: '🎭',
      siteId: 'beirut-music',
      name: b('Rahbani theater', 'مسرح الرحباني'),
      tagline: b('Musical plays that shaped a generation', 'مسرحيات غنائية شكّلت جيلاً'),
      history: b(
        'Assi and Mansour Rahbani built musical theater that married folklore, poetry, and modern staging. Their works with Fairuz became national cultural memory.',
        'بنى عاصي ومنصور رحباني مسرحاً غنائياً جمع الفولكلور والشعر والإخراج الحديث. صارت أعمالهما مع فيروز ذاكرة ثقافية وطنية.'
      ),
      tags: tags(['Theater', 'Folklore', 'Stage'], ['مسرح', 'فولكلور', 'خشبة']),
      image: '/lebanon/assets/music/rahbani.jpg'
    },
    {
      id: 'folk-village',
      emoji: '🥁',
      siteId: 'qadisha',
      name: b('Village folk song', 'أغنية القرية'),
      tagline: b('Harvest chants and mountain meters', 'أناشيد حصاد وأوزان جبل'),
      history: b(
        'Mountain and coastal villages keep work songs, wedding verses, and regional meters. Festivals and family gatherings still teach the next generation by ear.',
        'تحفظ قرى الجبل والساحل أغاني العمل وأبيات العرس والأوزان الإقليمية. ما زالت المهرجانات والاجتماعات العائلية تعلّم الجيل التالي بالأذن.'
      ),
      tags: tags(['Folk', 'Village', 'Oral'], ['شعبي', 'قرية', 'شفهي']),
      image: '/lebanon/assets/music/folk-village.jpg'
    },
    {
      id: 'contemporary',
      emoji: '🎧',
      siteId: 'beirut-music',
      name: b('Contemporary Beirut', 'بيروت المعاصرة'),
      tagline: b('Indie, electronic, and diaspora studios', 'إندي وإلكترو واستوديوهات شتات'),
      history: b(
        'Younger artists fuse Arabic melody with rock, electronic, and hip-hop. Beirut scenes and diaspora studios carry both protest song and nightclub experiment.',
        'يمزج فنانون أصغر اللحن العربي بالروك والإلكترو والهيب هوب. تحمل مشاهد بيروت واستوديوهات الشتات أغنية الاحتجاج وتجربة النادي معاً.'
      ),
      tags: tags(['Indie', 'Fusion', 'Diaspora'], ['إندي', 'مزج', 'شتات']),
      image: '/lebanon/assets/music/contemporary.jpg'
    }
  ],
  hookah: [
    {
      id: 'beirut-corniche',
      emoji: '🌊',
      siteId: 'beirut-cafe',
      name: b('Corniche evening', 'مساء الكورنيش'),
      tagline: b('Sea breeze, café tables, slow coals', 'نسيم بحر وطاولات مقهى وجمر بطيء'),
      history: b(
        'Beirut’s corniche fills after heat eases — walkers, coffee, and nargileh at shoreline cafés. The ritual is conversation as much as smoke.',
        'يمتلئ كورنيش بيروت بعد خفة الحر — مشاة وقهوة ونرجيلة في مقاهي الشاطئ. الطقس حديث بقدر ما هو دخان.'
      ),
      tags: tags(['Corniche', 'Café', 'Evening'], ['كورنيش', 'مقهى', 'مساء']),
      image: '/lebanon/assets/hookah/beirut-corniche.jpg'
    },
    {
      id: 'tripoli-nargileh',
      emoji: '🫖',
      siteId: 'tripoli',
      name: b('Tripoli nargileh', 'نرجيلة طرابلس'),
      tagline: b('Old-city pause after the souk', 'استراحة المدينة القديمة بعد السوق'),
      history: b(
        'Near Tripoli’s souks, cafés pour tea and set nargileh for friends who came to buy sweets or soap. Time stretches between the citadel and the river.',
        'قرب أسواق طرابلس تصب المقاهي الشاي وتُعد النرجيلة لأصدقاء جاؤوا لشراء الحلوى أو الصابون. يمتد الوقت بين القلعة والنهر.'
      ),
      tags: tags(['Souk', 'Tea', 'Nargileh'], ['سوق', 'شاي', 'نرجيلة']),
      image: '/lebanon/assets/hookah/tripoli-nargileh.jpg'
    },
    {
      id: 'hamra-cafe',
      emoji: '📚',
      siteId: 'beirut-cafe',
      name: b('Hamra café talk', 'حديث مقاهي الحمرا'),
      tagline: b('Books, politics, and long tables', 'كتب وسياسة وطاولات طويلة'),
      history: b(
        'Hamra’s café culture mixed students, journalists, and artists. Argileh and coffee fueled debates that outlasted any single menu.',
        'مزجت ثقافة مقاهي الحمرا الطلاب والصحافيين والفنانين. غذّت الأرجيلة والقهوة نقاشات أطول عمراً من أي قائمة طعام.'
      ),
      tags: tags(['Hamra', 'Talk', 'Coffee'], ['حمرا', 'حديث', 'قهوة']),
      image: '/lebanon/assets/hookah/hamra-cafe.jpg'
    },
    {
      id: 'mountain-argileh',
      emoji: '🏔️',
      siteId: 'beiteddine',
      name: b('Mountain argileh', 'أرجيلة الجبل'),
      tagline: b('Cool air and courtyard coals', 'هواء بارد وجمر الباحات'),
      history: b(
        'Above the coast, mountain restaurants set argileh in stone courtyards. Summer nights smell of apple tobacco and pine.',
        'فوق الساحل تضع مطاعم الجبل الأرجيلة في باحات حجرية. تفوح ليالي الصيف بتبغ التفاح والصنوبر.'
      ),
      tags: tags(['Mountain', 'Courtyard', 'Summer'], ['جبل', 'باحة', 'صيف']),
      image: '/lebanon/assets/hookah/mountain-argileh.jpg'
    }
  ],
  living: [
    {
      id: 'cedars',
      emoji: '🌲',
      siteId: 'cedars',
      name: b('Cedars', 'الأرز'),
      tagline: b('National tree of mountain and flag', 'شجرة الوطن في الجبل والعلم'),
      history: b(
        'Cedrus libani groves — especially the Cedars of God near Bsharri — symbolize endurance. The green cedar sits at the center of the national flag.',
        'حرش الأرز اللبناني — خصوصاً أرز الرب قرب بشري — يرمز للصمود. ويجلس الأرز الأخضر في وسط العلم الوطني.'
      ),
      tags: tags(['Tree', 'Flag', 'UNESCO'], ['شجرة', 'علم', 'يونسكو']),
      image: '/lebanon/assets/living/cedars.jpg'
    },
    {
      id: 'diaspora',
      emoji: '🌍',
      siteId: 'beirut',
      name: b('Diaspora', 'الشتات'),
      tagline: b('Lebanese communities across the world', 'جاليات لبنانية عبر العالم'),
      history: b(
        'Waves of emigration tied villages to São Paulo, Paris, West Africa, and the Gulf. Remittances, return visits, and food shops keep the map elastic.',
        'ربطت موجات الهجرة القرى بساو باولو وباريس وغرب أفريقيا والخليج. تُبقي التحويلات وزيارات العودة ومحلات الطعام الخريطة مرنة.'
      ),
      tags: tags(['Migration', 'Family', 'World'], ['هجرة', 'عائلة', 'عالم']),
      image: '/lebanon/assets/living/diaspora.jpg'
    },
    {
      id: 'calligraphy',
      emoji: '✒️',
      siteId: 'tripoli',
      name: b('Arabic calligraphy', 'الخط العربي'),
      tagline: b('Script as art on wall and page', 'الخط فن على الجدار والصفحة'),
      history: b(
        'Calligraphy schools and mosque inscriptions keep Arabic script as visual music. Beirut galleries and Tripoli mosques show living hands still training the pen.',
        'تحفظ مدارس الخط ونقوش المساجد الحرف العربي كموسيقى بصرية. تُظهر معارض بيروت ومساجد طرابلس أيادياً حية ما زالت تدرّب القلم.'
      ),
      tags: tags(['Script', 'Art', 'Mosque'], ['خط', 'فن', 'مسجد']),
      image: '/lebanon/assets/living/calligraphy.jpg'
    },
    {
      id: 'village',
      emoji: '🏡',
      siteId: 'qadisha',
      name: b('Mountain village', 'قرية الجبل'),
      tagline: b('Stone houses and Sunday tables', 'بيوت حجر وطاولات الأحد'),
      history: b(
        'Village life organizes festivals, olive harvests, and family houses that fill in summer. Many city stories still begin with a mountain surname.',
        'تنظّم حياة القرية المهرجانات وقطاف الزيتون وبيوت العائلة التي تمتلئ صيفاً. ما زالت حكايات كثيرة في المدينة تبدأ بلقب جبلي.'
      ),
      tags: tags(['Village', 'Stone', 'Family'], ['قرية', 'حجر', 'عائلة']),
      image: '/lebanon/assets/living/village.jpg'
    },
    {
      id: 'mediterranean-coast',
      emoji: '🏖️',
      siteId: 'byblos',
      name: b('Mediterranean coast', 'الساحل المتوسطي'),
      tagline: b('Harbors, corniche walks, salt air', 'موانئ ومشي كورنيش وهواء ملح'),
      history: b(
        'From Tyre to Tripoli the coast is Lebanon’s open edge — fishing boats, beach clubs, and Phoenician memory under the same blue water.',
        'من صور إلى طرابلس الساحل حافة لبنان المفتوحة — قوارب صيد ونوادي شاطئ وذاكرة فينيقية تحت الماء الأزرق نفسه.'
      ),
      tags: tags(['Coast', 'Harbor', 'Sea'], ['ساحل', 'ميناء', 'بحر']),
      image: '/lebanon/assets/living/mediterranean-coast.jpg'
    },
    {
      id: 'arabic-print',
      emoji: '📰',
      siteId: 'beirut',
      name: b('Arabic print culture', 'ثقافة الطباعة العربية'),
      tagline: b('Press, books, and Beirut publishing', 'صحافة وكتب ونشر بيروت'),
      history: b(
        'Beirut long served as a regional capital of Arabic publishing and newspapers. Print shops and bookstores remain part of the city’s self-image even after crises.',
        'طالما خدمت بيروت كعاصمة إقليمية للنشر والصحافة العربية. ما زالت المطابع والمكتبات جزءاً من صورة المدينة لنفسها حتى بعد الأزمات.'
      ),
      tags: tags(['Press', 'Books', 'Beirut'], ['صحافة', 'كتب', 'بيروت']),
      image: '/lebanon/assets/living/arabic-print.jpg'
    }
  ],
  phrases: [
    { ar: 'أهلاً وسهلاً', translit: 'Ahlan wa sahlan', en: 'Welcome / hello' },
    { ar: 'مرحبا', translit: 'Marḥaba', en: 'Hi' },
    { ar: 'كيفك؟', translit: 'Kīfak? / Kīfik?', en: 'How are you?' },
    { ar: 'منيح', translit: 'Mnīḥ', en: 'Good / fine' },
    { ar: 'يسلمو', translit: 'Yislamu', en: 'Thanks (Levantine)' },
    { ar: 'عن جد؟', translit: 'ʿAn jadd?', en: 'Really?' },
    { ar: 'خلّينا نروح', translit: 'Khallīnā nrūḥ', en: "Let's go" },
    { ar: 'صحة وهنا', translit: 'Ṣaḥa w hana', en: 'Bon appétit / to your health' },
    { ar: 'شو الأخبار؟', translit: 'Shū l-akhbār?', en: "What's new?" },
    { ar: 'مع السلامة', translit: 'Maʿa salāme', en: 'Goodbye' }
  ]
};

assertUiKeys(content.ui);

const reel = {
  id: 'lebanon-hyperframes-reel',
  title: b('Lebanon HyperFrame Tour', 'جولة لبنان المصوّرة'),
  portrait: '/lebanon/assets/karim-guide-portrait-256.png',
  voice: { en: 'en-US-Neural2-D', ar: 'ar-XA-Wavenet-B' },
  pitch: -1,
  speakingRate: 0.98,
  scenes: [
    {
      id: 'welcome',
      anchor: 'lbHero',
      spotlight: '#lbHero',
      durationMs: 7200,
      kicker: b('Welcome', 'أهلاً'),
      title: b('Ahlan — Lebanon', 'أهلاً — لبنان'),
      copy: b('I am Karim. Cedars, coasts, and living tables — told with care.', 'أنا كريم. أرز وسواحل ومائدة حية — تُروى بعناية.'),
      narration: b(
        'Ahlan wa sahlan. I am Karim. This atlas is Lebanon — Phoenician harbors, Roman Baalbek, cedar mountains, and a living table of mezze and song. Give me a few minutes and I will walk you through the map, the eras, and the flavors.',
        'أهلاً وسهلاً. أنا كريم. هذا الأطلس لبنان — موانئ فينيقية وبعلبك الرومانية وجبال الأرز ومائدة حية من المزة والغناء. أعطني دقائق وأمشيك عبر الخريطة والعصور والنكهات.'
      )
    },
    {
      id: 'atlas',
      anchor: 'lbMap',
      spotlight: '#lbMap',
      action: 'openAtlas',
      durationMs: 7000,
      kicker: b('Atlas', 'أطلس'),
      title: b('The map opens', 'تُفتح الخريطة'),
      copy: b('Coast light, mountain stone, Bekaa plain — every pin a place you can stand.', 'ضوء ساحل وحجر جبل وسهل بقاع — كل علامة مكان يمكنك الوقوف فيه.'),
      narration: b(
        'First, the atlas. From Beirut to Tyre, from Byblos harbor to Baalbek’s temples — history pins, food towns, and living places. Select a name and the map leans in.',
        'أولاً الأطلس. من بيروت إلى صور، من ميناء جبيل إلى معابد بعلبك — علامات تاريخ وبلدات طعام وأماكن حيّة. اختر اسماً فتميل الخريطة نحوه.'
      )
    },
    {
      id: 'beirut',
      anchor: 'lbMap',
      spotlight: '#lbMapCanvas',
      action: 'focusBeirut',
      durationMs: 8200,
      kicker: b('Capital', 'العاصمة'),
      title: b('Beirut', 'بيروت'),
      copy: b('Mediterranean capital of cafés, press, and recovery.', 'عاصمة متوسطية للمقاهي والصحافة والتعافي.'),
      narration: b(
        'Start in Beirut. Port city, university city, café city — rebuilt more than once, still the loud heart of the republic and the soft landing for diaspora return.',
        'نبدأ من بيروت. مدينة ميناء وجامعة ومقهى — أُعيد بناؤها أكثر من مرة، وما زالت القلب الصاخب للجمهورية والمرفأ الهادئ لعودة الشتات.'
      )
    },
    {
      id: 'byblos',
      anchor: 'lbMap',
      spotlight: '#lbMapCanvas',
      action: 'focusByblos',
      durationMs: 7800,
      kicker: b('Harbor', 'ميناء'),
      title: b('Byblos', 'جبيل'),
      copy: b('Phoenician harbor, crusader castle, old souk.', 'ميناء فينيقي وقلعة صليبية وسوق قديم.'),
      narration: b(
        'Then Byblos — Jbeil. One of the oldest living cities, where Phoenician ships once loaded cedar and letters. The castle and souk still face the same blue sea.',
        'ثم جبيل. من أقدم المدن الحيّة، حيث حمّلت السفن الفينيقية يوماً الأرز والحروف. ما زالت القلعة والسوق تواجهان البحر الأزرق نفسه.'
      )
    },
    {
      id: 'baalbek',
      anchor: 'lbMap',
      spotlight: '#lbMapCanvas',
      action: 'focusBaalbek',
      durationMs: 8000,
      kicker: b('Stone memory', 'ذاكرة حجر'),
      title: b('Baalbek', 'بعلبك'),
      copy: b('Roman temples that still stun the Bekaa.', 'معابد رومانية ما زالت تذهل البقاع.'),
      narration: b(
        'East to Baalbek. Rome raised temples of astonishing scale at Heliopolis. Walk the stones and you feel how empire wanted to be seen in the Levant.',
        'شرقاً إلى بعلبك. رفعت روما معابد بمقياس مذهل في هليوبوليس. امشِ على الحجارة فتحس كيف أرادت الإمبراطورية أن تُرى في المشرق.'
      )
    },
    {
      id: 'eras',
      anchor: 'lbTimeline',
      spotlight: '#lbTimeline',
      action: 'openFirstEra',
      durationMs: 7500,
      kicker: b('Timeline', 'خط زمني'),
      title: b('Eras of Lebanon', 'عصور لبنان'),
      copy: b('Phoenician to today — select a layer to hear it.', 'من فينيقيا إلى اليوم — اختر طبقة لتسمعها.'),
      narration: b(
        'Open the timeline. Phoenician harbors, Roman temples, Byzantine and early Islamic towns, Crusader castles, Ottoman emirates, the French mandate, independence, and contemporary Lebanon — each layer has a place on the map.',
        'افتح الخط الزمني. موانئ فينيقية ومعابد رومانية وبلدات بيزنطية وإسلامية مبكرة وقلاع صليبية وإمارات عثمانية والانتداب الفرنسي والاستقلال ولبنان المعاصر — لكل طبقة مكان على الخريطة.'
      )
    },
    {
      id: 'food',
      anchor: 'lbFood',
      spotlight: '#lbFoodGrid',
      action: 'flipFirstFood',
      durationMs: 7200,
      kicker: b('Table', 'مائدة'),
      title: b('Mezze and tabbouleh', 'مزة وتبولة'),
      copy: b('Flip a plate — kibbeh, manakish, knafeh, and arak.', 'اقلب طبقاً — كبة ومناقيش وكنافة وعرق.'),
      narration: b(
        'At the table, tabbouleh meets kibbeh, manakish leaves the oven, and knafeh arrives with syrup. Flip a card and I will tell you why mezze is hospitality you can taste.',
        'على المائدة تلتقي التبولة بالكبة، وتخرج المناقيش من الفرن، وتصل الكنافة بالقطر. اقلب بطاقة وأخبرك لماذا المزة ضيافة تُذاق.'
      )
    },
    {
      id: 'music',
      anchor: 'lbMusic',
      spotlight: '#lbMusicGrid',
      action: 'flipFirstMusic',
      durationMs: 7000,
      kicker: b('Sound', 'صوت'),
      title: b('Fairuz and dabke', 'فيروز ودبكة'),
      copy: b('Radio icons, line dances, and oud nights.', 'أيقونات إذاعة ودبكات وليالي عود.'),
      narration: b(
        'Listen for Fairuz and the Rahbani stage, dabke lines at weddings, oud in Beirut salons, and new indie rooms. Flip a music card for the history behind the song.',
        'اسمع فيروز ومسرح الرحباني وصفوف الدبكة في الأعراس والعود في صالونات بيروت وغرف الإندي الجديدة. اقلب بطاقة موسيقى لتقرأ الحكاية خلف الأغنية.'
      )
    },
    {
      id: 'cafe',
      anchor: 'lbHookah',
      spotlight: '#lbHookahGrid',
      action: 'flipFirstHookah',
      durationMs: 6800,
      kicker: b('Café', 'مقهى'),
      title: b('Nargileh and talk', 'نرجيلة وحديث'),
      copy: b('Corniche coals — then long conversation.', 'جمر الكورنيش — ثم حديث طويل.'),
      narration: b(
        'In the café, coffee and nargileh come with talk. From Hamra tables to Tripoli souk pauses, the coals last only as long as the friendship.',
        'في المقهى تأتي القهوة والنرجيلة مع الحديث. من طاولات الحمرا إلى استراحات سوق طرابلس، لا يدوم الجمر أطول من الصداقة.'
      )
    },
    {
      id: 'living',
      anchor: 'lbLiving',
      spotlight: '#lbLivingGrid',
      action: 'flipFirstLiving',
      durationMs: 7200,
      kicker: b('Living', 'حياة'),
      title: b('Cedars and diaspora', 'أرز وشتات'),
      copy: b('Mountain trees, village stone, and print culture.', 'أشجار جبل وحجر قرية وثقافة طباعة.'),
      narration: b(
        'Living culture is the cedar on the flag, diaspora kitchens abroad, calligraphy, village Sundays, and the Mediterranean coast. These are not museum labels — they still organize the year.',
        'الثقافة الحيّة هي الأرز على العلم، ومطابخ الشتات في الخارج، والخط، وآحاد القرية، والساحل المتوسطي. هذه ليست بطاقات متحف — ما زالت تنظّم السنة.'
      )
    },
    {
      id: 'phrases',
      anchor: 'lbPhrases',
      spotlight: '#lbPhraseList',
      action: 'speakFirstPhrase',
      durationMs: 6500,
      kicker: b('Speak', 'تكلّم'),
      title: b('Kīfak?', 'كيفك؟'),
      copy: b('Press a phrase — I will say it aloud.', 'اضغط عبارة — سأقولها بصوت عالٍ.'),
      narration: b(
        'Before you go, take a greeting. Kīfak? Press any phrase on the page and I will say it for you in everyday Lebanese Arabic.',
        'قبل أن تمضي، خذ تحية. كيفك؟ اضغط أي عبارة في الصفحة وسأقولها لك بلبنانية يومية.'
      )
    },
    {
      id: 'close',
      anchor: 'lbGuide',
      spotlight: '#lbGuide',
      action: 'unflipCards',
      durationMs: 7000,
      kicker: b('Ask me', 'اسألني'),
      title: b('I am still here', 'ما زلت هنا'),
      copy: b('Ask Karim about Byblos, mezze, or Fairuz.', 'اسأل كريم عن جبيل أو المزة أو فيروز.'),
      narration: b(
        'That is the tour. Stay on the map, flip more cards, or ask me anything — Byblos harbor, Baalbek stones, tabbouleh, or the cedars. Maʿa salame for now, and welcome whenever you return.',
        'هذه هي الجولة. ابقَ على الخريطة، أو اقلب مزيداً من البطاقات، أو اسألني أي شيء — ميناء جبيل، وحجارة بعلبك، والتبولة، أو الأرز. مع السلامة الآن، وأهلاً بك كلما عدت.'
      )
    }
  ]
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, 'lebanon-content.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8');
writeFileSync(path.join(OUT_DIR, 'lebanon-story-reel.json'), `${JSON.stringify(reel, null, 2)}\n`, 'utf8');
console.log('Wrote lebanon-content.json and lebanon-story-reel.json');
