# Pagedown

Paste a URL and get the page's main article back as Markdown. The menus, footers, ads and scripts are cut and counted, links and images are made absolute, and the result can be copied or downloaded as a `.md` file.

Live at https://pagedown.bryancalabro.com.

## How it works

A Vercel function at `api/fetch` downloads the page on the server, refusing private and loopback addresses on every redirect, then Mozilla Readability picks the article and Turndown writes GitHub-flavored Markdown. For a page behind a login, paste its HTML instead: that conversion runs in the browser and the HTML never leaves it.

## Run it

```
npm install
npm run dev
npm test
npm run test:e2e
```

## Out of scope

- Crawling a whole site, following links, or a search API
- Running a page's JavaScript in a headless browser; pages that render only on the client come back thin
- Accounts, API keys, or a stored history of page bodies (only the URL, title and time of recent fetches are kept, in this browser)
- Any call to a language model
