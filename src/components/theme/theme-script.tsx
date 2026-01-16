/**
 * Inline script to prevent flash of wrong theme (FOUC).
 * Runs before React hydration to set the correct theme.
 */
export function ThemeScript() {
  const themeScript = `
    (function() {
      function getTheme() {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', getTheme());
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}
