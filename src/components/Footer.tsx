export function Footer() {
  // year comes from the visitor's clock, never hardcoded
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <a href="https://bryancalabro.com" className="footer-link">
        © {year} Bryan J. Calabro - {__APP_VERSION__}
      </a>
    </footer>
  )
}
