import { useState } from 'react';
import { SNOW } from '../lib/greeter';

const FEMALE_VOICE = 'en-US-Neural2-F';
const FEMALE_NAME = /female|zira|aria|jenny|samantha|susan|hazel|linda|heera|natasha|sonia|libby|michelle|karen|moira|tessa|fiona|catherine|emma/i;
const MALE_NAME = /david|mark|guy|ryan|george|james|daniel|ravi|brian|christopher|eric/i;

declare global {
  interface Window {
    speakWithGoogle?: (
      text: string,
      voice: string,
      options: { preferFemale: boolean; gender: string; speakingRate: number }
    ) => Promise<boolean>;
    ensureAudioUnlock?: () => Promise<unknown>;
  }
}

function femaleBrowserVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((v) => /^en/i.test(v.lang) && !MALE_NAME.test(v.name));
  return english.find((v) => FEMALE_NAME.test(v.name) && /^en-US/i.test(v.lang)) || english.find((v) => FEMALE_NAME.test(v.name)) || null;
}

function whenVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve([] as SpeechSynthesisVoice[]);
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const finish = () => {
      const list = synth.getVoices();
      if (!list.length) return;
      synth.removeEventListener('voiceschanged', finish);
      resolve(list);
    };
    synth.addEventListener('voiceschanged', finish);
    synth.getVoices();
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    }, 700);
  });
}

async function speakFemaleBrowser(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const voice = femaleBrowserVoice(await whenVoices());
  if (!voice) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang || 'en-US';
  utterance.rate = 1;
  synth.speak(utterance);
}

export default function Greeter() {
  const [heard, setHeard] = useState(false);

  async function sayHello() {
    window.ensureAudioUnlock?.();
    const speak = window.speakWithGoogle;
    if (speak) {
      const ok = await speak(SNOW.line, FEMALE_VOICE, { preferFemale: true, gender: 'female', speakingRate: 1 });
      if (ok) {
        setHeard(true);
        return;
      }
    }
    await speakFemaleBrowser(SNOW.line);
    setHeard(true);
  }

  return (
    <aside className="ski-greeter" aria-label={SNOW.name}>
      <img
        className="ski-greeter__photo"
        src={SNOW.portrait}
        width={480}
        height={480}
        alt="Snow, the snowboarder host, in a cream beanie and red Big Bear jacket"
      />
      <div className="ski-greeter__copy">
        <p className="ski-greeter__name">{SNOW.name}</p>
        <p>{SNOW.line}</p>
        <button type="button" onClick={sayHello}>
          {heard ? 'Say it again' : 'Say hello'}
        </button>
      </div>
    </aside>
  );
}
