/**
 * Opens the movie in Stremio. Stremio identifies movies by IMDb id, so the app's deep link
 * works directly; if the app doesn't take over (not installed), Stremio Web opens instead.
 */
export function StremioButton({ imdb }: { imdb: string }) {
  const app = `stremio:///detail/movie/${imdb}`;
  const web = `https://web.stremio.com/#/detail/movie/${imdb}`;

  const open = () => {
    let left = false;
    const onBlur = () => (left = true);
    window.addEventListener('blur', onBlur, { once: true });
    window.location.href = app;
    // If the browser is still in focus shortly after, no app handled the link.
    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      if (!left && document.visibilityState === 'visible') window.open(web, '_blank', 'noopener');
    }, 1500);
  };

  return (
    <span className="stremio">
      <button type="button" className="btn stremio-btn" onClick={open} title="Open in the Stremio app (falls back to Stremio Web)">
        ▶ Stremio
      </button>
      <a className="link small" href={web} target="_blank" rel="noreferrer" title="Open in Stremio Web">
        web
      </a>
    </span>
  );
}
