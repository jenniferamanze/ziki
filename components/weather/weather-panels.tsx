import type { Forecast } from "@/lib/weather/forecast";

/** Jenie's bulletin: one of three editions a day, written from the numbers. */
export function WeatherBulletin({ forecast }: { forecast: Forecast }) {
  return (
    <section aria-labelledby="zw-bulletin" className="flex flex-col gap-3 rounded-[20px] border border-zk-border bg-zk-surface p-5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-zk-info-bg font-extrabold text-zk-info-fg">J</span>
        <div className="flex flex-col">
          <h2 id="zw-bulletin" className="text-base font-extrabold text-zk-text">{forecast.editionTitle}</h2>
          <span className="text-xs text-zk-muted">with Jenie, your Ziki forecaster · updated {forecast.editionTime}</span>
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-zk-text">{forecast.bulletin}</p>
    </section>
  );
}

export function WeatherTomorrow({ forecast }: { forecast: Forecast }) {
  const { cleared, target } = forecast.tomorrow;
  const pct = target === 0 ? 100 : Math.round((cleared / target) * 100);
  return (
    <section aria-labelledby="zw-tomorrow" className="flex flex-col gap-3 rounded-[20px] border border-zk-border bg-zk-surface p-5">
      <h2 id="zw-tomorrow" className="text-base font-extrabold text-zk-text">Tomorrow</h2>
      <span className="text-[22px] font-extrabold text-zk-text">{forecast.tomorrow.label}</span>
      <p className="text-sm leading-relaxed text-zk-text2">{forecast.tomorrow.note}</p>
      <div
        role="progressbar"
        aria-label="Clouds cleared today towards a sunny tomorrow"
        aria-valuemin={0}
        aria-valuemax={Math.max(target, 1)}
        aria-valuenow={cleared}
        className="h-2.5 overflow-hidden rounded-full bg-zk-seg"
      >
        <div className="h-full rounded-full bg-[#ffc94a] transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-zk-muted">{cleared === 1 ? "1 cloud" : `${cleared} clouds`} cleared today</p>
    </section>
  );
}

export function WeatherDiary({ forecast, shareHref }: { forecast: Forecast; shareHref?: string }) {
  return (
    <section aria-labelledby="zw-diary" className="flex flex-col gap-3 rounded-[20px] border border-zk-border bg-zk-surface p-5">
      <h2 id="zw-diary" className="text-base font-extrabold text-zk-text">Weather diary</h2>
      {forecast.diary.length === 0 ? (
        <p className="text-sm text-zk-text2">
          Nothing rare this week yet. A day with 10 merges brings a merge rainbow.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {forecast.diary.map((entry) => (
            <li key={`${entry.kind}-${entry.detail}`} className="flex items-center gap-2.5 text-sm">
              <span aria-hidden="true" className="flex size-[34px] items-center justify-center rounded-[10px] bg-zk-warn-bg">
                {entry.kind === "rainbow" ? (
                  <svg width="22" height="14" viewBox="0 0 44 24" fill="none" strokeWidth="4" strokeLinecap="round">
                    <path d="M4 22a18 18 0 0 1 36 0" stroke="#f26b5b" />
                    <path d="M10 22a12 12 0 0 1 24 0" stroke="#5aa0f2" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a4e00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 3 6 14h6l-1 7 7-11h-6z" />
                  </svg>
                )}
              </span>
              <span className="flex-1 text-zk-text">
                <strong>{entry.label}</strong> · {entry.detail}
              </span>
              {shareHref && entry.kind === "rainbow" ? (
                <a href={shareHref} className="font-bold text-zk-accent hover:underline">Share</a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
