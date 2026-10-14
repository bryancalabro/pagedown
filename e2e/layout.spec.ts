import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { articleBody, stubApi } from "./stub";

// layout: nothing on the page is wider than a phone. copied from calabrodesign's
// skill-library/ops/new-app/templates/layout.spec.ts by /new-app step 3.
//
// unit and e2e suites passed while a header, a play bar, a select or a table ran past 320px
// (exposure, maze, nomad, ladder, fiveletters), a cost table clipped (tokens) and ids truncated at
// 390px (uuid). only geometry shows those, so this measures it: the page never scrolls sideways,
// and no visible element or line of text crosses the viewport's edge unless it sits inside a
// container that scrolls on x (overflow-x auto or scroll), where the reader can still reach it.
// an ancestor that clips (overflow hidden or clip) trims what is measured to its own box, so a
// visually hidden label or a carousel track is not an overflow, but html and body never excuse
// one: overflow-x hidden on the page hides the scroll and leaves the content cut off.
//
// add every route the app serves to ROUTES. decoration that bleeds on purpose sits inside a
// wrapper with overflow: clip.

const ROUTES = ["/"];
const WIDTHS = [320, 390];
// subpixel layout rounds; a real overflow is whole pixels
const SLACK = 1;

async function measure(page: Page) {
    return page.evaluate((slack) => {
        const edge = document.documentElement.clientWidth;
        const scroller = document.scrollingElement ?? document.documentElement;

        // the part of [left, right] a reader can see: null when a scroll container owns it or a
        // clipping ancestor hides all of it. starts at the first box whose overflow applies.
        const seen = (from: Element | null, left: number, right: number) => {
            for (let p = from; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
                const x = getComputedStyle(p).overflowX;
                if (x === "auto" || x === "scroll") return null;
                if (x === "hidden" || x === "clip") {
                    const c = p.getBoundingClientRect();
                    left = Math.max(left, c.left);
                    right = Math.min(right, c.right);
                }
            }
            return right > left ? { left, right } : null;
        };
        // wholly off-canvas is a closed drawer or a skip link, not a layout overflow
        const crosses = (s: { left: number; right: number } | null) =>
            !!s && s.right > 0 && s.left < edge && (s.left < -slack || s.right > edge + slack);
        const visible = (el: Element) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
        const name = (el: Element) =>
            el.tagName.toLowerCase() +
            (el.id ? `#${el.id}` : "") +
            (typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "");

        const offenders: string[] = [];
        for (const el of Array.from(document.body.querySelectorAll("*"))) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height || !visible(el)) continue;
            const s = seen(el.parentElement, r.left, r.right);
            if (crosses(s)) offenders.push(`${name(el)} spans ${Math.round(r.left)} to ${Math.round(r.right)}px`);
        }
        // a long word or id overflows its box without widening any element, so measure text too
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const owner = node.parentElement;
            const text = node.textContent?.trim();
            if (!owner || !text || !visible(owner)) continue;
            range.selectNodeContents(node);
            const line = Array.from(range.getClientRects()).find((r) => r.width && crosses(seen(owner, r.left, r.right)));
            if (line) offenders.push(`text "${text.slice(0, 40)}" in ${name(owner)} spans ${Math.round(line.left)} to ${Math.round(line.right)}px`);
        }
        return { scrollWidth: scroller.scrollWidth, innerWidth: window.innerWidth, offenders: offenders.slice(0, 12) };
    }, SLACK);
}

for (const route of ROUTES) {
    for (const width of WIDTHS) {
        test(`layout: ${route} fits a ${width}px viewport`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            await page.goto(route);
            await page.evaluate(() => document.fonts.ready);
            const { scrollWidth, innerWidth, offenders } = await measure(page);
            // soft, so a failure still lists the elements that made the page wide
            expect.soft(scrollWidth, "the page scrolls sideways").toBeLessThanOrEqual(innerWidth);
            expect(offenders, "visible content crosses the viewport edge outside an overflow-x scroll container").toEqual([]);
        });
    }
}

// the longest realistic state: an article fetched from a long address, every option on, the
// preview open, and the paste form with a long base address
const LONG_URL = "https://www.example-publication-with-a-long-name.com/2026/10/14/field-notes-on-quiet-software-and-why-it-matters-more-than-ever?ref=homepage";
for (const width of WIDTHS) {
    test(`layout: / with an article, every option and the preview fits a ${width}px viewport`, async ({ page }) => {
        await stubApi(page, () => ({ status: 200, body: { ...articleBody(LONG_URL), title: "Field notes on quiet software and why it matters more than ever before" } }));
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/");
        await page.getByLabel("Page link", { exact: true }).fill(LONG_URL);
        await page.getByRole("button", { name: "Fetch", exact: true }).click();
        for (const name of [/^Reference links/, /^Front matter/]) await page.getByRole("switch", { name }).check();
        await page.evaluate(() => document.fonts.ready);
        for (const step of ["raw", "preview"]) {
            if (step === "preview") await page.getByRole("button", { name: "Preview", exact: true }).click();
            await page.locator(step === "raw" ? "pre.markdown" : ".preview h1").waitFor();
            const { scrollWidth, innerWidth, offenders } = await measure(page);
            expect.soft(scrollWidth, `${step}: the page scrolls sideways`).toBeLessThanOrEqual(innerWidth);
            expect(offenders, `${step}: content crosses the viewport edge`).toEqual([]);
        }
        await page.getByRole("button", { name: "Paste HTML", exact: true }).click();
        await page.getByLabel(/^Page address/).fill(LONG_URL);
        const { offenders } = await measure(page);
        expect(offenders, "paste form crosses the viewport edge").toEqual([]);
    });
}
