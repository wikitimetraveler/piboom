const BENS_WEATHER_URL = 'https://www.bensweather.com/';

export default function BensWeather() {
  return (
    <section className="ski-bens" aria-label="Ben's Weather">
      <div className="ski-bens__bar">
        <div>
          <h2>Ben&apos;s Weather</h2>
          <p>Big Bear station, shown as published. The local desk for Bear Mountain, Snow Summit, and Snow Valley.</p>
        </div>
        <a href={BENS_WEATHER_URL} target="_blank" rel="noreferrer">
          Open bensweather.com
        </a>
      </div>
      <iframe
        className="ski-bens__frame"
        title="Ben's Weather — Big Bear"
        src={BENS_WEATHER_URL}
      />
    </section>
  );
}
