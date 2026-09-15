/**
 * Major Arcana parlor deck for Rose — entertainment tarot, not fortune-telling.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const ARCANA = [
    { id: 'the-fool', number: 0, roman: '0', name: 'The Fool', glyph: '○', keyword: 'begin', traits: ['open', 'curious', 'unburdened'], oracle: 'Rose turns the Fool. Step off the edge with light bags. The parlor likes a first step that does not ask permission.', shadow: 'A leap that never looks down.', gift: 'Begin without the whole map.', askRose: 'Read The Fool for me' },
    { id: 'the-magician', number: 1, roman: 'I', name: 'The Magician', glyph: '✶', keyword: 'will', traits: ['skilled', 'focused', 'ready'], oracle: 'Rose lays the Magician. Tools are already on the cloth. Speak the wish as work.', shadow: 'Tricks without a true aim.', gift: 'Will that gathers what is near.', askRose: 'Read The Magician for me' },
    { id: 'the-high-priestess', number: 2, roman: 'II', name: 'The High Priestess', glyph: '☽', keyword: 'know', traits: ['quiet', 'intuitive', 'veiled'], oracle: 'Rose tips the Priestess. Listen behind the curtain. Not every answer wants a stage.', shadow: 'Secrets that starve the room.', gift: 'Knowing that waits its turn.', askRose: 'Read The High Priestess for me' },
    { id: 'the-empress', number: 3, roman: 'III', name: 'The Empress', glyph: '♀', keyword: 'grow', traits: ['lush', 'creative', 'generous'], oracle: 'Rose sets the Empress among petals. Feed what you want to grow. Beauty with a backbone.', shadow: 'Abundance that forgets the roots.', gift: 'A table that keeps filling.', askRose: 'Read The Empress for me' },
    { id: 'the-emperor', number: 4, roman: 'IV', name: 'The Emperor', glyph: '♂', keyword: 'order', traits: ['steady', 'structured', 'protective'], oracle: 'Rose plants the Emperor. Build the frame so the parlor can rest. Order is care when it is not a cage.', shadow: 'Rules that crush the living room.', gift: 'A firm seat for the scared.', askRose: 'Read The Emperor for me' },
    { id: 'the-hierophant', number: 5, roman: 'V', name: 'The Hierophant', glyph: '†', keyword: 'teach', traits: ['traditional', 'guiding', 'shared'], oracle: 'Rose opens the Hierophant. Learn the old song, then sing it clean. Teaching is a shared key.', shadow: 'Dogma that never lets you ask.', gift: 'A rite that holds a community.', askRose: 'Read The Hierophant for me' },
    { id: 'the-lovers', number: 6, roman: 'VI', name: 'The Lovers', glyph: '♡', keyword: 'choose', traits: ['aligned', 'honest', 'bonded'], oracle: 'Rose slides the Lovers. Choose the bond that matches your mouth and your feet.', shadow: 'A pretty choice that never commits.', gift: 'Alignment that swears aloud.', askRose: 'Read The Lovers for me' },
    { id: 'the-chariot', number: 7, roman: 'VII', name: 'The Chariot', glyph: '▣', keyword: 'drive', traits: ['directed', 'brave', 'moving'], oracle: 'Rose drives the Chariot. Hold both reins. Victory is steering, not speed alone.', shadow: 'Force that forgets the road.', gift: 'Momentum with a destination.', askRose: 'Read The Chariot for me' },
    { id: 'strength', number: 8, roman: 'VIII', name: 'Strength', glyph: '∞', keyword: 'gentle', traits: ['calm', 'courageous', 'tender'], oracle: 'Rose shows Strength. Soft hands on the lion. Courage that does not shout.', shadow: 'A smile that hides a clenched jaw.', gift: 'Power that stays kind.', askRose: 'Read Strength for me' },
    { id: 'the-hermit', number: 9, roman: 'IX', name: 'The Hermit', glyph: '⬡', keyword: 'seek', traits: ['solitary', 'wise', 'lit'], oracle: 'Rose lifts the Hermit’s lantern. Withdraw to hear yourself. Come back with one clear sentence.', shadow: 'A cave that becomes a forever.', gift: 'Light carried for the return.', askRose: 'Read The Hermit for me' },
    { id: 'wheel-of-fortune', number: 10, roman: 'X', name: 'Wheel of Fortune', glyph: '◎', keyword: 'turn', traits: ['changing', 'timely', 'cyclic'], oracle: 'Rose spins the Wheel. What rises will fall — ride the turn without clinging.', shadow: 'Blaming the wheel for every bump.', gift: 'Luck met with readiness.', askRose: 'Read Wheel of Fortune for me' },
    { id: 'justice', number: 11, roman: 'XI', name: 'Justice', glyph: '⚖', keyword: 'balance', traits: ['fair', 'clear', 'accountable'], oracle: 'Rose levels Justice. Weigh the missing weight. Truth with a calm face.', shadow: 'Verdicts without mercy.', gift: 'Fairness that can still forgive.', askRose: 'Read Justice for me' },
    { id: 'the-hanged-man', number: 12, roman: 'XII', name: 'The Hanged Man', glyph: '▽', keyword: 'pause', traits: ['suspended', 'seeing', 'surrendered'], oracle: 'Rose hangs the card. Pause upside down. New eyes before new motion.', shadow: 'Waiting that pretends to be wisdom.', gift: 'A surrender that teaches.', askRose: 'Read The Hanged Man for me' },
    { id: 'death', number: 13, roman: 'XIII', name: 'Death', glyph: '☠', keyword: 'end', traits: ['closing', 'clearing', 'reborn'], oracle: 'Rose names Death without flinch. End the skin that pinches. Clearing makes room.', shadow: 'Fear that freezes the door shut.', gift: 'An ending that composts.', askRose: 'Read Death for me' },
    { id: 'temperance', number: 14, roman: 'XIV', name: 'Temperance', glyph: '⚗', keyword: 'blend', traits: ['measured', 'healing', 'patient'], oracle: 'Rose pours Temperance. Mix hot and cool until the cup is drinkable.', shadow: 'Dilution that tastes like nothing.', gift: 'A blend that heals the edge.', askRose: 'Read Temperance for me' },
    { id: 'the-devil', number: 15, roman: 'XV', name: 'The Devil', glyph: '⛓', keyword: 'bind', traits: ['tempted', 'honest', 'untangling'], oracle: 'Rose faces the Devil. Name the chain. Freedom starts when the knot is spoken.', shadow: 'Pleasure that owns the house.', gift: 'Seeing the bind clearly.', askRose: 'Read The Devil for me' },
    { id: 'the-tower', number: 16, roman: 'XVI', name: 'The Tower', glyph: '⚡', keyword: 'break', traits: ['sudden', 'true', 'rebuilding'], oracle: 'Rose strikes the Tower. The false roof goes. Rebuild on what still stands.', shadow: 'Drama for its own spark.', gift: 'A crack that lets light in.', askRose: 'Read The Tower for me' },
    { id: 'the-star', number: 17, roman: 'XVII', name: 'The Star', glyph: '✦', keyword: 'hope', traits: ['quiet', 'renewing', 'open'], oracle: 'Rose tips the Star. Hope without a speech. Pour water under a clear night.', shadow: 'Wishful fog with no next step.', gift: 'Renewal that stays soft.', askRose: 'Read The Star for me' },
    { id: 'the-moon', number: 18, roman: 'XVIII', name: 'The Moon', glyph: '☾', keyword: 'dream', traits: ['uncertain', 'imaginative', 'deep'], oracle: 'Rose draws the Moon. Trust the path even when it wavers. Dreams tell half-truths — walk carefully.', shadow: 'Fear wearing a mask of intuition.', gift: 'Imagination that still finds shore.', askRose: 'Read The Moon for me' },
    { id: 'the-sun', number: 19, roman: 'XIX', name: 'The Sun', glyph: '☀', keyword: 'joy', traits: ['bright', 'simple', 'alive'], oracle: 'Rose opens the Sun. Warmth without apology. Joy as a plain fact.', shadow: 'Glare that blinds the soft places.', gift: 'Daylight you can share.', askRose: 'Read The Sun for me' },
    { id: 'judgement', number: 20, roman: 'XX', name: 'Judgement', glyph: '🎺', keyword: 'awaken', traits: ['called', 'forgiving', 'rising'], oracle: 'Rose sounds Judgement. Answer the call you already hear. Rise without the old scoreboard.', shadow: 'Self-judgment that never ends.', gift: 'A second chance spoken aloud.', askRose: 'Read Judgement for me' },
    { id: 'the-world', number: 21, roman: 'XXI', name: 'The World', glyph: '◉', keyword: 'complete', traits: ['whole', 'dancing', 'arrived'], oracle: 'Rose closes with the World. A cycle finishes. Dance once, then begin again.', shadow: 'Clinging to a finished round.', gift: 'Completion that still invites more.', askRose: 'Read The World for me' },
  ];

  function cardById(id) {
    const key = String(id || '').trim().toLowerCase();
    return ARCANA.find((card) => card.id === key) || null;
  }

  function factSheet() {
    return ARCANA.map(
      (card) =>
        `- ${card.roman} ${card.name} (${card.keyword}): ${card.oracle} Gift: ${card.gift} Watch: ${card.shadow}`
    ).join('\n');
  }

  root.AstrologyArcana = {
    ARCANA,
    cardById,
    factSheet,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
