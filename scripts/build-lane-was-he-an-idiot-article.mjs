/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * One-off generator for data/lane-was-he-an-idiot-article.json (source: Wikisource transcription).
 * Run: node scripts/build-lane-was-he-an-idiot-article.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'lane-was-he-an-idiot-article.json');

const ASSET = '/family/assets/was-he-an-idiot';

const p1 = `IN the quiet little town of Hampton Falls, New Hampshire, there has lately died a man whose life appears to the writer to present a psychological study of marked interest. Nature, in what are called her freaks, or abnormal products, oft-times gives us hints of powers altogether beyond the ordinary, but destined, it may be, through the development of the race, to become common possessions of mankind. This man furnishes a case in point.`;

const p2 = `The subject of our paper was about five feet six inches in height, when standing upright, but he stooped very much as he walked, his hands hanging far forward. His body was long, his legs very short, so that in walking he made the lifting, jerking movement in his step characteristic of quadrupeds trained to walk upright. His forehead, to the eye of a phrenologist, was very fully and finely developed. His occiput rose in a high point, but on each side there was a very deep depression. Phrenologically speaking, his head would have been considered well formed, save for these two depressions at the back.`;

const p3 = `His education, if so we may call it, was limited to learning the letters of the alphabet, so as to know them singly at sight, but he was unable to combine them into syllables or words. He could count as far as five or six, but beyond that became confused. He had a decided literary taste, judging from his interest in books and papers, in perusing which he spent much of his time, and apparently found much enjoyment. He did not hold the paper with column perpendicular, but horizontal, reading always from right to left. If any one gave him a book or paper, with page or column perpendicular, he at once shook his head, and placed it with the column horizontal. While perusing the paper, he would stop occasionally, lean back in his chair, and laugh, as if much amused at the matter. That he gathered some peculiar impression of what was in the paper is plain from the fact that he would be greatly interested in some part, and carefully lay the paper away till his sister came to visit them at the old home, when he would eagerly go and get it, and, pointing to the part that had interested him, would say, "Read—read!" There was another peculiarity about his reading. He would begin to read when it was growing dark, and continue till hardly anything was distinguishable to others in the room. At first thought, one would naturally suppose that he could not see, or really read, but was simply indulging in some kind of idiotic amusement. One simple fact seems to negative such a conclusion. He kept old papers filed away in the garret, hundreds of them in different piles. If, by chance, an article happened to be spoken of by the family in conversation as having been in some paper six months or a year before, and the desire expressed to see it again, this man would go to the garret, and from a pile of a hundred, in total darkness, select the one containing the article mentioned, and bring it down to the family to read. This he did again and again, yet he could not read a single word as others commonly read.`;

const p4 = `The mathematical powers of this man were really wonderful in certain directions. Without a moment's seeming thought he would tell the dominical letter for any year past or future that might be named. There seemed no limit to his power in this one line. He appeared to go through no process of calculation, but at once saw or grasped the result as by some more inward or subtile power of apprehension. His brother again and again proved the correctness of his answers, although the mathematical result that the brother obtained by a half-hour's "figuring" this seeming idiot attained in a moment. Strangers coming to the house would oft-times tell him their age, the day and month of their birth. He would immediately tell them the day of the week they were born, also the day of the week their birthday would fall upon in any year to come. The day of the week that Christmas or fourth of July would come in any year they would mention, he would tell without a moment's apparent calculation, and yet he could not count, or reckon in the ordinary way, more than a child of three years old! His particular literary preference seemed to be for almanacs, often having three or four about him, which he apparently studied and compared. When it came near the end of the year, he was anxious and urgent to get the new year's almanac.`;

const p5 = `There was one peculiar performance that betokened a certain degree of musical taste and apprehension. He would sit for hours, with a board two or three feet long resting on his knees, and rub ribbon-blocks over it in various ways, producing different sounds, not altogether without method and with a kind of crude harmony. In this he found great enjoyment, often leaning back in his chair and laughing heartily at some unexpected combination of sounds. In the warm weather he employed a musical instrument of grand proportions, for he used the whole side of a long, old-fashioned barn, rubbing the blocks up and down as high as he could reach, the different boards giving forth somewhat different sounds as he rubbed his blocks over them. In a crude way he seemed to play upon the different boards, as an organist touches the different keys of his instrument. After years of this kind of musical performance, the boards on the side of the barn were worn quite thin.`;

const p6 = `He would never use or touch, if he could help it, any sharp-edged tool, being afraid of them as of some animal that might sting or bite. He was a hearty eater, and while eating would frequently stop and make the peculiar grunt characteristic of the hog while eating, then turning his head a little would seem to listen, and then go on eating.`;

const p7 = `Was this man a case of arrested development? Looked at in one way, he appeared so. The great length of the body, the short lower limbs, the forward stoop, the arms hanging far forward, the voracious eating, the frequent grunt, the animal-like turning of the head and listening while eating—all these things point to arrested development. On the other hand, the excessive development of certain other senses or faculties seems to show how, when certain unfolding powers and organs of the human being are suppressed, the life-forces shoot out and up enormously in other organs and senses; as in a young growing tree, if the top be broken off and most of the main branches lopped away, the sap flows more vigorously into the remaining branches, and they become enormously developed. Thus the common mathematical powers of counting and calculation appeared to be nearly aborted or suppressed, as he was unable to count or solve the simplest arithmetical problem in the common way; yet he solved in an instant mathematical problems that, by what we call our normal mental faculties, required several minutes of careful figuring to find a solution. Blinded and imprisoned where we commonly see and understand, had some of his faculties and powers surpassed the ordinary bounds in a higher and finer development? It appeared so. Was he an idiot? What meant his power of seeing in the dark, of selecting from among a file of hundreds a paper containing a particular article, published a year or more before, though he had never learned to read a sentence as we understand reading? May it not be that the printed page gives impressions of one kind to our common sight and understanding, and of another, finer kind to subtiler senses, and a different, may be a clearer understanding? Thus we trace a man's way by the tracks he makes in the snow or soft ground, while his dog follows him more surely, not by these so palpable signs, but by some finer track or impression, over or within what we see. May it not be that while we trace and apprehend the thoughts of the printed page, through the impression of the black lettering, this man received some finer impression from the printed page than any we know?`;

const p8 = `In closing this short account of a remarkable individual, we would only record one or two events prior to his birth, which afford some little explanation of what appears in this man as arrested development. His mother, not long before his birth, passed through a severe attack of measles. This at the time was not reckoned in the account of causes that might have unfavorably influenced the unborn child. One thing, however, was recognized as the probable cause of a prenatal organic disturbance, viz., the fright of the mother by some hogs kept on the farm. Herein we have a possible explanation of those strange actions while eating, the peculiar grunt, the turning of the head, and the listening attitude, which are frequently observed when swine are feeding.`;

const doc = {
  version: 4,
  title: 'WAS HE AN IDIOT?',
  byline: 'By Rev. W. A. CRAM.',
  source: 'Popular Science Monthly, May 1884, vol. 25',
  rightsNote:
    'Transcription from Wikisource (public domain in the United States). Minor obvious typographical fixes from the scanned magazine.',
  wikisourceUrl:
    'https://en.wikisource.org/wiki/Popular_Science_Monthly/Volume_25/May_1884/Was_He_an_Idiot%3F',
  blocks: [
    { type: 'p', text: p1 },
    { type: 'p', text: p2 },
    {
      type: 'figure',
      src: `${ASSET}/instruction.png`,
      alt: 'Illustration: instruction or limited learning',
      caption: 'Figure: limited schooling—letters at sight only, no syllables or words.'
    },
    { type: 'p', text: p3 },
    {
      type: 'figure',
      src: `${ASSET}/reader.png`,
      alt: 'Illustration: reading newspapers and papers',
      caption: 'Figure: reading habits—horizontal columns, papers in the garret, finding articles in the dark.'
    },
    { type: 'p', text: p4 },
    {
      type: 'figure',
      src: `${ASSET}/almanac.png`,
      alt: 'Illustration: almanacs and calendrical ability',
      caption: 'Figure: dominical letters, weekdays, birthdays—and a strong preference for almanacs.'
    },
    { type: 'p', text: p5 },
    {
      type: 'figure',
      src: `${ASSET}/wood-music.png`,
      alt: 'Illustration: rubbing blocks for music on board and barn',
      caption: 'Figure: “crude harmony”—ribbon-blocks on a board and on the barn wall.'
    },
    { type: 'p', text: p6 },
    {
      type: 'figure',
      src: `${ASSET}/fear-of-sharp-objects.png`,
      alt: 'Illustration: aversion to sharp-edged tools',
      caption:
        'Figure: avoiding sharp tools—“afraid of them as of some animal that might sting or bite.”'
    },
    { type: 'p', text: p7 },
    { type: 'p', text: p8 },
    {
      type: 'figure',
      src: `${ASSET}/prenatal-fright.png`,
      alt: 'Illustration: prenatal causes—measles and fright by farm hogs',
      caption: 'Figure: prior to birth—measles and the mother’s fright by hogs (period illustration).'
    }
  ]
};

fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
console.log('Wrote', OUT);
