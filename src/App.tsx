import { EmptyState } from './components/EmptyState'
import { Footer } from './components/Footer'
import { ThemeToggle } from './components/ThemeToggle'
import { Wordmark } from './components/Wordmark'

// scaffold placeholder: the header, the designed empty state and the footer. the product replaces it.
export default function App() {
  return (
    <div className="page">
      <header className="site-header">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="main">
        <EmptyState />
      </main>
      <Footer />
    </div>
  )
}
