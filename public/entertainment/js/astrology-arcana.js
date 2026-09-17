/**
 * Full Rider–Waite parlor tarot for Rose — 78 cards with public-domain RWS art.
 * Entertainment reading only — not fortune-telling or astronomy.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const IMAGE_DIR = '/entertainment/assets/tarot';
  const COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath';

  const MAJOR_META = [
    { id: 'the-fool', number: 0, roman: '0', name: 'The Fool', file: 'RWS Tarot 00 Fool.jpg', glyph: '○', keyword: 'begin', traits: ['open', 'curious', 'unburdened'], oracle: 'Rose turns the Fool. Step off the edge with light bags. The parlor likes a first step that does not ask permission.', shadow: 'A leap that never looks down.', gift: 'Begin without the whole map.' },
    { id: 'the-magician', number: 1, roman: 'I', name: 'The Magician', file: 'RWS Tarot 01 Magician.jpg', glyph: '✶', keyword: 'will', traits: ['skilled', 'focused', 'ready'], oracle: 'Rose lays the Magician. Tools are already on the cloth. Speak the wish as work.', shadow: 'Tricks without a true aim.', gift: 'Will that gathers what is near.' },
    { id: 'the-high-priestess', number: 2, roman: 'II', name: 'The High Priestess', file: 'RWS Tarot 02 High Priestess.jpg', glyph: '☽', keyword: 'know', traits: ['quiet', 'intuitive', 'veiled'], oracle: 'Rose tips the Priestess. Listen behind the curtain. Not every answer wants a stage.', shadow: 'Secrets that starve the room.', gift: 'Knowing that waits its turn.' },
    { id: 'the-empress', number: 3, roman: 'III', name: 'The Empress', file: 'RWS Tarot 03 Empress.jpg', glyph: '♀', keyword: 'grow', traits: ['lush', 'creative', 'generous'], oracle: 'Rose sets the Empress among petals. Feed what you want to grow. Beauty with a backbone.', shadow: 'Abundance that forgets the roots.', gift: 'A table that keeps filling.' },
    { id: 'the-emperor', number: 4, roman: 'IV', name: 'The Emperor', file: 'RWS Tarot 04 Emperor.jpg', glyph: '♂', keyword: 'order', traits: ['steady', 'structured', 'protective'], oracle: 'Rose plants the Emperor. Build the frame so the parlor can rest. Order is care when it is not a cage.', shadow: 'Rules that crush the living room.', gift: 'A firm seat for the scared.' },
    { id: 'the-hierophant', number: 5, roman: 'V', name: 'The Hierophant', file: 'RWS Tarot 05 Hierophant.jpg', glyph: '†', keyword: 'teach', traits: ['traditional', 'guiding', 'shared'], oracle: 'Rose opens the Hierophant. Learn the old song, then sing it clean. Teaching is a shared key.', shadow: 'Dogma that never lets you ask.', gift: 'A rite that holds a community.' },
    { id: 'the-lovers', number: 6, roman: 'VI', name: 'The Lovers', file: 'RWS Tarot 06 Lovers.jpg', glyph: '♡', keyword: 'choose', traits: ['aligned', 'honest', 'bonded'], oracle: 'Rose slides the Lovers. Choose the bond that matches your mouth and your feet.', shadow: 'A pretty choice that never commits.', gift: 'Alignment that swears aloud.' },
    { id: 'the-chariot', number: 7, roman: 'VII', name: 'The Chariot', file: 'RWS Tarot 07 Chariot.jpg', glyph: '▣', keyword: 'drive', traits: ['directed', 'brave', 'moving'], oracle: 'Rose drives the Chariot. Hold both reins. Victory is steering, not speed alone.', shadow: 'Force that forgets the road.', gift: 'Momentum with a destination.' },
    { id: 'strength', number: 8, roman: 'VIII', name: 'Strength', file: 'RWS Tarot 08 Strength.jpg', glyph: '∞', keyword: 'gentle', traits: ['calm', 'courageous', 'tender'], oracle: 'Rose shows Strength. Soft hands on the lion. Courage that does not shout.', shadow: 'A smile that hides a clenched jaw.', gift: 'Power that stays kind.' },
    { id: 'the-hermit', number: 9, roman: 'IX', name: 'The Hermit', file: 'RWS Tarot 09 Hermit.jpg', glyph: '⬡', keyword: 'seek', traits: ['solitary', 'wise', 'lit'], oracle: "Rose lifts the Hermit's lantern. Withdraw to hear yourself. Come back with one clear sentence.", shadow: 'A cave that becomes a forever.', gift: 'Light carried for the return.' },
    { id: 'wheel-of-fortune', number: 10, roman: 'X', name: 'Wheel of Fortune', file: 'RWS Tarot 10 Wheel of Fortune.jpg', glyph: '◎', keyword: 'turn', traits: ['changing', 'timely', 'cyclic'], oracle: 'Rose spins the Wheel. What rises will fall — ride the turn without clinging.', shadow: 'Blaming the wheel for every bump.', gift: 'Luck met with readiness.' },
    { id: 'justice', number: 11, roman: 'XI', name: 'Justice', file: 'RWS Tarot 11 Justice.jpg', glyph: '⚖', keyword: 'balance', traits: ['fair', 'clear', 'accountable'], oracle: 'Rose levels Justice. Weigh the missing weight. Truth with a calm face.', shadow: 'Verdicts without mercy.', gift: 'Fairness that can still forgive.' },
    { id: 'the-hanged-man', number: 12, roman: 'XII', name: 'The Hanged Man', file: 'RWS Tarot 12 Hanged Man.jpg', glyph: '▽', keyword: 'pause', traits: ['suspended', 'seeing', 'surrendered'], oracle: 'Rose hangs the card. Pause upside down. New eyes before new motion.', shadow: 'Waiting that pretends to be wisdom.', gift: 'A surrender that teaches.' },
    { id: 'death', number: 13, roman: 'XIII', name: 'Death', file: 'RWS Tarot 13 Death.jpg', glyph: '☠', keyword: 'end', traits: ['closing', 'clearing', 'reborn'], oracle: 'Rose names Death without flinch. End the skin that pinches. Clearing makes room.', shadow: 'Fear that freezes the door shut.', gift: 'An ending that composts.' },
    { id: 'temperance', number: 14, roman: 'XIV', name: 'Temperance', file: 'RWS Tarot 14 Temperance.jpg', glyph: '⚗', keyword: 'blend', traits: ['measured', 'healing', 'patient'], oracle: 'Rose pours Temperance. Mix hot and cool until the cup is drinkable.', shadow: 'Dilution that tastes like nothing.', gift: 'A blend that heals the edge.' },
    { id: 'the-devil', number: 15, roman: 'XV', name: 'The Devil', file: 'RWS Tarot 15 Devil.jpg', glyph: '⛓', keyword: 'bind', traits: ['tempted', 'honest', 'untangling'], oracle: 'Rose faces the Devil. Name the chain. Freedom starts when the knot is spoken.', shadow: 'Pleasure that owns the house.', gift: 'Seeing the bind clearly.' },
    { id: 'the-tower', number: 16, roman: 'XVI', name: 'The Tower', file: 'RWS Tarot 16 Tower.jpg', glyph: '⚡', keyword: 'break', traits: ['sudden', 'true', 'rebuilding'], oracle: 'Rose strikes the Tower. The false roof goes. Rebuild on what still stands.', shadow: 'Drama for its own spark.', gift: 'A crack that lets light in.' },
    { id: 'the-star', number: 17, roman: 'XVII', name: 'The Star', file: 'RWS Tarot 17 Star.jpg', glyph: '✦', keyword: 'hope', traits: ['quiet', 'renewing', 'open'], oracle: 'Rose tips the Star. Hope without a speech. Pour water under a clear night.', shadow: 'Wishful fog with no next step.', gift: 'Renewal that stays soft.' },
    { id: 'the-moon', number: 18, roman: 'XVIII', name: 'The Moon', file: 'RWS Tarot 18 Moon.jpg', glyph: '☾', keyword: 'dream', traits: ['uncertain', 'imaginative', 'deep'], oracle: 'Rose draws the Moon. Trust the path even when it wavers. Dreams tell half-truths — walk carefully.', shadow: 'Fear wearing a mask of intuition.', gift: 'Imagination that still finds shore.' },
    { id: 'the-sun', number: 19, roman: 'XIX', name: 'The Sun', file: 'RWS Tarot 19 Sun.jpg', glyph: '☀', keyword: 'joy', traits: ['bright', 'simple', 'alive'], oracle: 'Rose opens the Sun. Warmth without apology. Joy as a plain fact.', shadow: 'Glare that blinds the soft places.', gift: 'Daylight you can share.' },
    { id: 'judgement', number: 20, roman: 'XX', name: 'Judgement', file: 'RWS Tarot 20 Judgement.jpg', glyph: '🎺', keyword: 'awaken', traits: ['called', 'forgiving', 'rising'], oracle: 'Rose sounds Judgement. Answer the call you already hear. Rise without the old scoreboard.', shadow: 'Self-judgment that never ends.', gift: 'A second chance spoken aloud.' },
    { id: 'the-world', number: 21, roman: 'XXI', name: 'The World', file: 'RWS Tarot 21 World.jpg', glyph: '◉', keyword: 'complete', traits: ['whole', 'dancing', 'arrived'], oracle: 'Rose closes with the World. A cycle finishes. Dance once, then begin again.', shadow: 'Clinging to a finished round.', gift: 'Completion that still invites more.' },
  ];

  const SUITS = {
    wands: {
      id: 'wands',
      label: 'Wands',
      filePrefix: 'Wands',
      glyph: '🜂',
      element: 'fire',
      theme: 'will, spark, and work that moves',
      ranks: {
        1: { name: 'Ace of Wands', keyword: 'spark', oracle: 'Rose deals the Ace of Wands. A clean spark wants a first step — light the work while it is hot.', gift: 'Permission to begin.', shadow: 'A spark that never becomes a flame.', traits: ['starting', 'eager', 'alive'] },
        2: { name: 'Two of Wands', keyword: 'plan', oracle: 'Rose sets the Two of Wands. Look past the balcony. Choose a direction and own the map.', gift: 'A plan that faces the horizon.', shadow: 'Planning that never leaves the rail.', traits: ['vision', 'choice', 'poised'] },
        3: { name: 'Three of Wands', keyword: 'expand', oracle: 'Rose tips the Three of Wands. Ships are already out. Watch what returns and widen the berth.', gift: 'Expansion with patience.', shadow: 'Waiting without tending the docks.', traits: ['horizon', 'trade', 'growth'] },
        4: { name: 'Four of Wands', keyword: 'home', oracle: 'Rose opens the Four of Wands. Celebrate the threshold. Joy that builds a room.', gift: 'A welcome that holds.', shadow: 'Party without a foundation.', traits: ['festive', 'stable', 'shared'] },
        5: { name: 'Five of Wands', keyword: 'clash', oracle: 'Rose deals the Five of Wands. Sparks fly in the practice yard. Compete without drawing blood.', gift: 'Honest contest.', shadow: 'Noise that never learns.', traits: ['contest', 'messy', 'alive'] },
        6: { name: 'Six of Wands', keyword: 'victory', oracle: 'Rose lifts the Six of Wands. Take the cheer, then keep walking. Victory is a mile marker.', gift: 'Recognition earned.', shadow: 'Applause that becomes a cage.', traits: ['proud', 'seen', 'forward'] },
        7: { name: 'Seven of Wands', keyword: 'stand', oracle: 'Rose plants the Seven of Wands. Hold the high ground. Defend what you already know is yours.', gift: 'Courage under pressure.', shadow: 'Defending everything, resting nowhere.', traits: ['defiant', 'firm', 'tested'] },
        8: { name: 'Eight of Wands', keyword: 'swift', oracle: 'Rose flies the Eight of Wands. News and motion arrive together. Clear the runway.', gift: 'Speed with aim.', shadow: 'Rush that scatters the arrows.', traits: ['fast', 'clear', 'urgent'] },
        9: { name: 'Nine of Wands', keyword: 'guard', oracle: 'Rose braces the Nine of Wands. Bandaged but upright. Rest the watch without dropping the staff.', gift: 'Resilience with boundaries.', shadow: 'Suspicion that never softens.', traits: ['wary', 'strong', 'tired'] },
        10: { name: 'Ten of Wands', keyword: 'burden', oracle: 'Rose names the Ten of Wands. Too many sticks for one back. Set some down before the door.', gift: 'Permission to lighten the load.', shadow: 'Martyrdom wearing a hero cape.', traits: ['loaded', 'dutiful', 'strained'] },
        11: { name: 'Page of Wands', keyword: 'messenger', oracle: 'Rose smiles at the Page of Wands. A curious messenger. Try the idea like a first letter.', gift: 'Fresh courage to explore.', shadow: 'Enthusiasm without follow-through.', traits: ['curious', 'bold', 'young'] },
        12: { name: 'Knight of Wands', keyword: 'charge', oracle: 'Rose rides with the Knight of Wands. Charge when the road is clear — and know when to rein in.', gift: 'Passionate motion.', shadow: 'Impulse that burns the bridge.', traits: ['fiery', 'swift', 'restless'] },
        13: { name: 'Queen of Wands', keyword: 'warmth', oracle: 'Rose greets the Queen of Wands. Warm authority. Lead with presence, not noise.', gift: 'Confident hospitality.', shadow: 'Charisma that scorches the shy.', traits: ['magnetic', 'steady', 'creative'] },
        14: { name: 'King of Wands', keyword: 'lead', oracle: 'Rose crowns the King of Wands. Vision that delegates. Lead the fire without becoming the blaze.', gift: 'Leadership with heart.', shadow: 'Ego that mistimes the campaign.', traits: ['visionary', 'decisive', 'bold'] },
      },
    },
    cups: {
      id: 'cups',
      label: 'Cups',
      filePrefix: 'Cups',
      glyph: '🜄',
      element: 'water',
      theme: 'feeling, bond, and the cup that holds',
      ranks: {
        1: { name: 'Ace of Cups', keyword: 'open', oracle: 'Rose pours the Ace of Cups. A new well of feeling. Let the heart fill before you name it.', gift: 'Emotional beginning.', shadow: 'Overflow with no vessel.', traits: ['tender', 'new', 'receptive'] },
        2: { name: 'Two of Cups', keyword: 'bond', oracle: 'Rose tips the Two of Cups. A meeting of equals. Offer the cup and mean it.', gift: 'Mutual recognition.', shadow: 'Romance that skips the truth.', traits: ['partnered', 'kind', 'mirrored'] },
        3: { name: 'Three of Cups', keyword: 'toast', oracle: 'Rose lifts the Three of Cups. Friendship as feast. Celebrate who stayed.', gift: 'Shared joy.', shadow: 'Toast that forgets the morning.', traits: ['social', 'glad', 'supportive'] },
        4: { name: 'Four of Cups', keyword: 'apathy', oracle: 'Rose shows the Four of Cups. A cup offered while you stare elsewhere. Notice what still arrives.', gift: 'Honest pause.', shadow: 'Numbness mistaken for wisdom.', traits: ['withdrawn', 'weary', 'choosing'] },
        5: { name: 'Five of Cups', keyword: 'grief', oracle: 'Rose sits with the Five of Cups. Spilled cups hurt. Turn enough to see what still stands.', gift: 'Grief that can look up.', shadow: 'Loss that refuses the remaining cups.', traits: ['mourning', 'regret', 'turning'] },
        6: { name: 'Six of Cups', keyword: 'memory', oracle: 'Rose softens the Six of Cups. Kind memory. Give something simple from the old garden.', gift: 'Innocent exchange.', shadow: 'Nostalgia that traps the present.', traits: ['nostalgic', 'gentle', 'giving'] },
        7: { name: 'Seven of Cups', keyword: 'choice', oracle: 'Rose fans the Seven of Cups. Many visions. Pick one cup that can survive daylight.', gift: 'Imagination with a decision.', shadow: 'Fantasy that never lands.', traits: ['dreamy', 'tempted', 'selecting'] },
        8: { name: 'Eight of Cups', keyword: 'leave', oracle: 'Rose walks the Eight of Cups. Leave the stacked cups that no longer feed you. Climb toward quieter water.', gift: 'Courage to walk away.', shadow: 'Leaving only to avoid feeling.', traits: ['departing', 'seeking', 'honest'] },
        9: { name: 'Nine of Cups', keyword: 'wish', oracle: 'Rose smiles at the Nine of Cups. Wish granted with a belly laugh. Enjoy without clutching.', gift: 'Contentment earned.', shadow: 'Smugness that closes the door.', traits: ['satisfied', 'proud', 'warm'] },
        10: { name: 'Ten of Cups', keyword: 'home', oracle: 'Rose opens the Ten of Cups. Rainbow over the house. Belonging that includes everyone at the table.', gift: 'Emotional fullness.', shadow: 'A picture-perfect lie.', traits: ['family', 'peace', 'shared'] },
        11: { name: 'Page of Cups', keyword: 'message', oracle: 'Rose nods to the Page of Cups. A soft message from the deep. Answer with curiosity, not armor.', gift: 'Emotional news.', shadow: 'Sensitivity that floods the room.', traits: ['dreamy', 'kind', 'open'] },
        12: { name: 'Knight of Cups', keyword: 'offer', oracle: 'Rose rides the Knight of Cups. An offer from the heart. Receive it, then test if the horse can stay.', gift: 'Romantic courage.', shadow: 'Charm without follow-through.', traits: ['ideal', 'poetic', 'seeking'] },
        13: { name: 'Queen of Cups', keyword: 'hold', oracle: 'Rose honors the Queen of Cups. Hold feeling without drowning. Empathy with a shore.', gift: 'Deep listening.', shadow: 'Absorbing everyone else\'s weather.', traits: ['intuitive', 'calm', 'caring'] },
        14: { name: 'King of Cups', keyword: 'compose', oracle: 'Rose seats the King of Cups. Feeling ruled with composure. Lead the tide, do not become the storm.', gift: 'Emotional mastery.', shadow: 'Control that freezes warmth.', traits: ['balanced', 'wise', 'steady'] },
      },
    },
    swords: {
      id: 'swords',
      label: 'Swords',
      filePrefix: 'Swords',
      glyph: '🜁',
      element: 'air',
      theme: 'mind, truth, and the cutting edge',
      ranks: {
        1: { name: 'Ace of Swords', keyword: 'clarity', oracle: 'Rose raises the Ace of Swords. A clean cut of truth. Name what is sharp and necessary.', gift: 'Mental breakthrough.', shadow: 'Truth used as a weapon.', traits: ['clear', 'decisive', 'piercing'] },
        2: { name: 'Two of Swords', keyword: 'stalemate', oracle: 'Rose shows the Two of Swords. Blindfold and balance. Remove one cloth and choose.', gift: 'Pause before the cut.', shadow: 'Avoidance dressed as peace.', traits: ['blocked', 'weighing', 'quiet'] },
        3: { name: 'Three of Swords', keyword: 'hurt', oracle: 'Rose names the Three of Swords. Heart pierced, still beating. Grief wants air, not silence.', gift: 'Honest sorrow.', shadow: 'Replaying the wound forever.', traits: ['pain', 'truth', 'release'] },
        4: { name: 'Four of Swords', keyword: 'rest', oracle: 'Rose lays the Four of Swords. Rest the blade. Recovery is part of the fight.', gift: 'Sacred pause.', shadow: 'Retreat that becomes disappearance.', traits: ['resting', 'healing', 'still'] },
        5: { name: 'Five of Swords', keyword: 'hollow', oracle: 'Rose watches the Five of Swords. Win that empties the field. Ask if the prize was worth the walkers leaving.', gift: 'Seeing the cost.', shadow: 'Victory that isolates.', traits: ['conflict', 'ego', 'aftermath'] },
        6: { name: 'Six of Swords', keyword: 'passage', oracle: 'Rose rows the Six of Swords. Leave rough water. The boat is small — bring only what you need.', gift: 'Transition toward calmer mind.', shadow: 'Fleeing without learning.', traits: ['moving', 'quiet', 'guided'] },
        7: { name: 'Seven of Swords', keyword: 'strategy', oracle: 'Rose eyes the Seven of Swords. Strategy or theft — know which you are doing. Slippery plans need daylight.', gift: 'Clever exit.', shadow: 'Deceit that trips itself.', traits: ['crafty', 'alone', 'calculating'] },
        8: { name: 'Eight of Swords', keyword: 'bind', oracle: 'Rose loosens the Eight of Swords. Bound by thought more than rope. The path out is smaller than fear says.', gift: 'Seeing the exit.', shadow: 'Helplessness as a habit.', traits: ['trapped', 'anxious', 'awakening'] },
        9: { name: 'Nine of Swords', keyword: 'worry', oracle: 'Rose sits with the Nine of Swords. Night thoughts. Speak one fear aloud so it shrinks.', gift: 'Worry brought into light.', shadow: 'Spirals that never leave the bed.', traits: ['anxious', 'sleepless', 'honest'] },
        10: { name: 'Ten of Swords', keyword: 'ending', oracle: 'Rose names the Ten of Swords. The worst picture. Dawn still arrives — end the story that is already over.', gift: 'Clean ending.', shadow: 'Drama that prolongs the knives.', traits: ['final', 'raw', 'sunrise'] },
        11: { name: 'Page of Swords', keyword: 'curious', oracle: 'Rose tips the Page of Swords. Curious mind on watch. Ask sharp questions kindly.', gift: 'Fresh inquiry.', shadow: 'Gossip wearing a reporter hat.', traits: ['alert', 'learning', 'restless'] },
        12: { name: 'Knight of Swords', keyword: 'charge', oracle: 'Rose rides the Knight of Swords. Charge with a thesis. Slow enough to still hear the room.', gift: 'Brave clarity.', shadow: 'Argument that tramples care.', traits: ['direct', 'fast', 'blunt'] },
        13: { name: 'Queen of Swords', keyword: 'discern', oracle: 'Rose honors the Queen of Swords. Discernment with a soft edge. Truth that still makes tea.', gift: 'Clear boundaries.', shadow: 'Coldness mistaken for wisdom.', traits: ['keen', 'independent', 'honest'] },
        14: { name: 'King of Swords', keyword: 'judge', oracle: 'Rose seats the King of Swords. Fair judgment. Rule with reason, leave room for mercy.', gift: 'Ethical clarity.', shadow: 'Law without heart.', traits: ['authoritative', 'logical', 'just'] },
      },
    },
    pentacles: {
      id: 'pentacles',
      label: 'Pentacles',
      filePrefix: 'Pents',
      glyph: '🜃',
      element: 'earth',
      theme: 'body, craft, and what you can hold',
      ranks: {
        1: { name: 'Ace of Pentacles', keyword: 'seed', oracle: 'Rose places the Ace of Pentacles. A seed of matter. Plant it where you can tend it daily.', gift: 'Tangible beginning.', shadow: 'Opportunity left in the dirt.', traits: ['prosperous', 'grounded', 'new'] },
        2: { name: 'Two of Pentacles', keyword: 'juggle', oracle: 'Rose juggles the Two of Pentacles. Keep the rhythm. Prioritize before the coins drop.', gift: 'Flexible balance.', shadow: 'Busywork that never chooses.', traits: ['adapting', 'busy', 'playful'] },
        3: { name: 'Three of Pentacles', keyword: 'craft', oracle: 'Rose admires the Three of Pentacles. Craft shared. Build with others who know their tools.', gift: 'Skilled collaboration.', shadow: 'Ego that refuses apprentices.', traits: ['team', 'mastery', 'work'] },
        4: { name: 'Four of Pentacles', keyword: 'hold', oracle: 'Rose notes the Four of Pentacles. Holding tight. Ask what you are protecting — and what you are starving.', gift: 'Security awareness.', shadow: 'Clutching that blocks flow.', traits: ['guarded', 'stable', 'tense'] },
        5: { name: 'Five of Pentacles', keyword: 'lack', oracle: 'Rose walks the Five of Pentacles. Cold outside the window. Look for the door that is already lit.', gift: 'Asking for help.', shadow: 'Pride that stays in the snow.', traits: ['hardship', 'exile', 'seeking'] },
        6: { name: 'Six of Pentacles', keyword: 'share', oracle: 'Rose balances the Six of Pentacles. Give and receive with open hands. Charity that keeps dignity.', gift: 'Fair exchange.', shadow: 'Strings attached to the gift.', traits: ['generous', 'balanced', 'kind'] },
        7: { name: 'Seven of Pentacles', keyword: 'wait', oracle: 'Rose tends the Seven of Pentacles. Pause in the garden. Assess before you dig everything up.', gift: 'Patient investment.', shadow: 'Impatience that ruins the crop.', traits: ['reviewing', 'patient', 'earthy'] },
        8: { name: 'Eight of Pentacles', keyword: 'practice', oracle: 'Rose watches the Eight of Pentacles. Practice the craft. Small coins of skill stack into mastery.', gift: 'Dedicated work.', shadow: 'Drudgery without joy.', traits: ['diligent', 'focused', 'learning'] },
        9: { name: 'Nine of Pentacles', keyword: 'ripe', oracle: 'Rose strolls the Nine of Pentacles. Self-made garden. Enjoy the fruit you grew alone — then share a pear.', gift: 'Independent abundance.', shadow: 'Isolation mistaken for luxury.', traits: ['refined', 'self-sufficient', 'calm'] },
        10: { name: 'Ten of Pentacles', keyword: 'legacy', oracle: 'Rose opens the Ten of Pentacles. Legacy under the arch. Wealth that includes the people in the courtyard.', gift: 'Lasting security.', shadow: 'Status without belonging.', traits: ['family', 'wealth', 'rooted'] },
        11: { name: 'Page of Pentacles', keyword: 'study', oracle: 'Rose smiles at the Page of Pentacles. A student of the tangible. Study what you can touch.', gift: 'Practical curiosity.', shadow: 'Planning that never practices.', traits: ['earnest', 'curious', 'grounded'] },
        12: { name: 'Knight of Pentacles', keyword: 'steady', oracle: 'Rose rides the Knight of Pentacles. Slow horse, sure road. Reliability as romance.', gift: 'Steady progress.', shadow: 'Stubborn pace that misses the season.', traits: ['methodical', 'loyal', 'slow'] },
        13: { name: 'Queen of Pentacles', keyword: 'nourish', oracle: 'Rose honors the Queen of Pentacles. Nourish the body and the budget. Care that feeds the house.', gift: 'Practical warmth.', shadow: 'Overgiving until empty.', traits: ['nurturing', 'resourceful', 'present'] },
        14: { name: 'King of Pentacles', keyword: 'provide', oracle: 'Rose seats the King of Pentacles. Provide without possessiveness. Steward the orchard.', gift: 'Reliable abundance.', shadow: 'Control dressed as care.', traits: ['prosperous', 'steady', 'generous'] },
      },
    },
  };

  function imagePaths(id, commonsFile) {
    return {
      image: `${IMAGE_DIR}/${id}.jpg`,
      commonsFile,
      commonsUrl: `${COMMONS}/${encodeURIComponent(commonsFile)}?width=480`,
    };
  }

  function finishCard(partial) {
    return {
      ...partial,
      askRose: `Read ${partial.name} for me`,
      arcana: partial.suit === 'major' ? 'major' : 'minor',
    };
  }

  const ARCANA = MAJOR_META.map((m) =>
    finishCard({
      ...m,
      suit: 'major',
      suitLabel: 'Major Arcana',
      rank: m.number,
      ...imagePaths(m.id, m.file),
    })
  );

  const MINORS = [];
  for (const suit of Object.values(SUITS)) {
    for (let n = 1; n <= 14; n += 1) {
      const rank = suit.ranks[n];
      const file = `${suit.filePrefix}${String(n).padStart(2, '0')}.jpg`;
      const id = rank.name
        .toLowerCase()
        .replace(/ of /g, '-of-')
        .replace(/\s+/g, '-');
      MINORS.push(
        finishCard({
          id,
          number: n,
          roman: String(n),
          name: rank.name,
          suit: suit.id,
          suitLabel: suit.label,
          rank: n,
          glyph: suit.glyph,
          keyword: rank.keyword,
          traits: rank.traits,
          oracle: rank.oracle,
          gift: rank.gift,
          shadow: rank.shadow,
          element: suit.element,
          ...imagePaths(id, file),
        })
      );
    }
  }

  const DECK = [...ARCANA, ...MINORS];

  function cardById(id) {
    const key = String(id || '').trim().toLowerCase();
    return DECK.find((card) => card.id === key) || null;
  }

  function cardsBySuit(suit) {
    const key = String(suit || '').trim().toLowerCase();
    if (!key || key === 'all') return DECK.slice();
    if (key === 'major' || key === 'majors' || key === 'arcana') return ARCANA.slice();
    return DECK.filter((card) => card.suit === key);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleCopy(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * Deterministic upright three-card parlor draw: Situation / Cross / Path.
   * @param {number} seed
   * @returns {{ situation: object, cross: object, path: object, seed: number } | null}
   */
  function spreadFromDeck(seed) {
    if (!DECK.length) return null;
    const rng = mulberry32((Number(seed) >>> 0) || 1);
    const drawn = shuffleCopy(DECK, rng);
    return {
      situation: drawn[0],
      cross: drawn[1],
      path: drawn[2],
      seed: (Number(seed) >>> 0) || 1,
    };
  }

  function imageSrc(card) {
    if (!card) return '';
    return card.image || card.commonsUrl || '';
  }

  function factSheet() {
    const lines = [
      '### How Rose uses the deck',
      'Shuffle with intention, cut once, draw upright for parlor play. A three-card line can be Situation / Cross / Path. Majors speak big life chapters; minors speak daily weather by suit (Wands fire/work, Cups water/feeling, Swords air/mind, Pentacles earth/body-money). Rose teaches method and meaning — entertainment only, never medical, legal, or fatal prophecy.',
      '',
      '### Major Arcana (22)',
    ];
    for (const card of ARCANA) {
      lines.push(
        `- ${card.roman} ${card.name} (${card.keyword}): ${card.oracle} Gift: ${card.gift} Watch: ${card.shadow}`
      );
    }
    lines.push('', '### Minor Arcana (56)');
    for (const suit of Object.values(SUITS)) {
      lines.push(`#### ${suit.label} — ${suit.theme}`);
      for (const card of MINORS.filter((c) => c.suit === suit.id)) {
        lines.push(
          `- ${card.name} (${card.keyword}): ${card.oracle} Gift: ${card.gift} Watch: ${card.shadow}`
        );
      }
    }
    return lines.join('\n');
  }

  /** Manifest for the image fetch script (Node + browser). */
  function imageManifest() {
    return DECK.map((card) => ({
      id: card.id,
      commonsFile: card.commonsFile,
      local: card.image,
    }));
  }

  root.AstrologyArcana = {
    ARCANA,
    MINORS,
    DECK,
    TAROT: DECK,
    SUITS,
    cardById,
    cardsBySuit,
    spreadFromDeck,
    imageSrc,
    factSheet,
    imageManifest,
    IMAGE_DIR,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
