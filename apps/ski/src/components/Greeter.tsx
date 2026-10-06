import { useState } from 'react';
import { SNOW } from '../lib/greeter';

export default function Greeter() {
  const [heard, setHeard] = useState(false);

  function sayHello() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(SNOW.line);
    const female = synth
      .getVoices()
      .find((v) => /^en-US/i.test(v.lang) && /female|zira|aria|jenny|samantha/i.test(v.name));
    if (female) utterance.voice = female;
    utterance.rate = 1;
    utterance.lang = 'en-US';
    synth.speak(utterance);
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
