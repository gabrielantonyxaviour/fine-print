const REPO = 'https://github.com/gabrielantonyxaviour/fine-print';

export function Nav() {
  const path = window.location.pathname;
  const link = (href: string, label: string) => (
    <a href={href} className={path === href ? 'on' : ''}>{label}</a>
  );
  return (
    <nav className="nav">
      <a className="nav-brand" href="/"><span className="mark">¶</span> Fine Print</a>
      <div className="nav-links">
        {link('/demo', 'Demo')}
        {link('/eval', 'Evaluation')}
        <a href={REPO} className="nav-gh">GitHub</a>
      </div>
    </nav>
  );
}
