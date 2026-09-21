#input_type_name: ExtractSiteStyleInput
#output_type_name: ExtractSiteStyleResult
#function_name: extract_site_style

# Deliberately stdlib + httpx only. `#python_packages` resolves at import time by
# shelling out to `uv` in the API container, and not every deployment has it — a
# probe of asur returned "Function dependency builder is not installed". bs4 and
# tinycss2 would be a convenience here, not a capability, so they are not worth
# an import that fails on one server and not another.

import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import httpx
from pydantic import BaseModel, Field

from lemma_sdk import FunctionContext

MAX_SHEETS = 8
MAX_CSS_BYTES = 1_500_000
TIMEOUT_SECONDS = 20.0
USER_AGENT = "LemmaBrandDesign/1.0 (+brand intake; respects robots)"

HEX = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
FUNCTIONAL_COLOR = re.compile(r"\b(?:rgba?|hsla?|oklch|lab)\([^)]{0,120}\)")
CUSTOM_PROPERTY = re.compile(r"--([A-Za-z0-9_-]{1,60})\s*:\s*([^;}]{1,200})")
FONT_FAMILY = re.compile(r"font-family\s*:\s*([^;}]{1,240})", re.IGNORECASE)
BORDER_RADIUS = re.compile(r"border-radius\s*:\s*([^;}]{1,80})", re.IGNORECASE)
FONT_FACE_FAMILY = re.compile(
    r"@font-face\s*\{[^}]*?font-family\s*:\s*([^;}]{1,120})", re.IGNORECASE | re.DOTALL
)
VAR_REFERENCE = re.compile(
    r"var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]{0,160}))?\)", re.IGNORECASE
)
MAX_VAR_DEPTH = 5


class SiteMeta(BaseModel):
    url: str
    final_url: str
    title: str = ""
    site_name: str = ""
    description: str = ""
    og_image: str = ""
    theme_color: str = ""


class Tally(BaseModel):
    value: str
    count: int


class LogoCandidate(BaseModel):
    url: str
    why: str


class ExtractSiteStyleInput(BaseModel):
    url: str
    max_stylesheets: int = MAX_SHEETS


class ExtractSiteStyleResult(BaseModel):
    ok: bool
    site: SiteMeta
    custom_properties: list[Tally] = Field(default_factory=list)
    # Custom properties whose value resolves to a real colour — the site's
    # own palette, under the site's own names.
    palette_properties: list[Tally] = Field(default_factory=list)
    colors: list[Tally] = Field(default_factory=list)
    font_families: list[Tally] = Field(default_factory=list)
    declared_faces: list[str] = Field(default_factory=list)
    radii: list[Tally] = Field(default_factory=list)
    logo_candidates: list[LogoCandidate] = Field(default_factory=list)
    icons: list[str] = Field(default_factory=list)
    stylesheets: list[str] = Field(default_factory=list)
    # Anything the caller should know before trusting the numbers — above all,
    # "this page is a JS shell, go and use the browser instead".
    notes: list[str] = Field(default_factory=list)


class _Scraper(HTMLParser):
    """Collects only what a brand read needs, and never builds a tree."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stylesheets: list[str] = []
        self.icons: list[str] = []
        self.inline_css: list[str] = []
        self.logos: list[LogoCandidate] = []
        self.meta: dict[str, str] = {}
        self.title = ""
        self._in_title = False
        self._in_style = False
        self._body_text_length = 0
        self._in_skipped = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        got = {key: (value or "") for key, value in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "style":
            self._in_style = True
        elif tag in ("script", "noscript"):
            self._in_skipped = True
        elif tag == "link":
            rel = got.get("rel", "").lower()
            href = got.get("href", "")
            if not href:
                return
            if "stylesheet" in rel:
                self.stylesheets.append(href)
            elif "icon" in rel:
                self.icons.append(href)
        elif tag == "meta":
            key = (got.get("property") or got.get("name") or "").lower()
            if key:
                self.meta[key] = got.get("content", "")
        elif tag in ("img", "image"):
            haystack = " ".join(
                (got.get("class", ""), got.get("id", ""), got.get("alt", ""), got.get("src", ""))
            ).lower()
            if "logo" in haystack or "wordmark" in haystack or "brandmark" in haystack:
                source = got.get("src") or got.get("data-src") or ""
                if source:
                    self.logos.append(LogoCandidate(url=source, why="img matched logo/wordmark"))

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "style":
            self._in_style = False
        elif tag in ("script", "noscript"):
            self._in_skipped = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data.strip()
        elif self._in_style:
            self.inline_css.append(data)
        elif not self._in_skipped:
            self._body_text_length += len(data.strip())

    @property
    def visible_text_length(self) -> int:
        return self._body_text_length


def _normalise_color(raw: str) -> str:
    value = raw.strip().lower()
    if value.startswith("#") and len(value) == 4:
        return "#" + "".join(character * 2 for character in value[1:])
    return re.sub(r"\s+", " ", value)


def _tally(values: list[str], limit: int) -> list[Tally]:
    counts: dict[str, int] = {}
    for value in values:
        cleaned = re.sub(r"\s+", " ", value.strip().strip("\"'"))
        if cleaned:
            counts[cleaned] = counts.get(cleaned, 0) + 1
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    return [Tally(value=value, count=count) for value, count in ranked[:limit]]


def _property_map(properties: list[tuple[str, str]]) -> dict[str, str]:
    """One value per custom property: the one the sheet uses most.

    A token defined once per theme (light, dark, a campaign) appears several
    times with different values. The most frequent definition is the closest
    thing to "the default" that static CSS can tell us.
    """
    counts: dict[str, dict[str, int]] = {}
    for name, value in properties:
        cleaned = re.sub(r"\s+", " ", value.strip())
        if cleaned:
            bucket = counts.setdefault(name, {})
            bucket[cleaned] = bucket.get(cleaned, 0) + 1
    return {
        name: max(bucket.items(), key=lambda pair: (pair[1], pair[0]))[0]
        for name, bucket in counts.items()
    }


def _resolve(value: str, mapping: dict[str, str], depth: int = 0) -> str:
    """Follow var() indirection so the tallies carry values, not aliases.

    Without this the top font stack on a design-system site is
    `var(--hds-font-family)`, which tells the caller nothing it can apply.
    """
    if depth >= MAX_VAR_DEPTH or "var(" not in value:
        return value

    def swap(match: re.Match[str]) -> str:
        name, fallback = match.group(1), (match.group(2) or "").strip()
        return mapping.get(name) or fallback or match.group(0)

    resolved = VAR_REFERENCE.sub(swap, value)
    if resolved == value:
        return resolved
    return _resolve(resolved, mapping, depth + 1)


def _is_color(value: str) -> bool:
    candidate = value.strip()
    return bool(HEX.fullmatch(candidate) or FUNCTIONAL_COLOR.fullmatch(candidate))


def _harvest(css: str) -> tuple[list[str], list[str], list[str], list[tuple[str, str]], list[str]]:
    colors = [_normalise_color(hit) for hit in HEX.findall(css)]
    colors += [_normalise_color(hit) for hit in FUNCTIONAL_COLOR.findall(css)]
    families = FONT_FAMILY.findall(css)
    radii = BORDER_RADIUS.findall(css)
    properties = [(name, value.strip()) for name, value in CUSTOM_PROPERTY.findall(css)]
    faces = [face.strip().strip("\"'") for face in FONT_FACE_FAMILY.findall(css)]
    return colors, families, radii, properties, faces


async def extract_site_style(
    ctx: FunctionContext, data: ExtractSiteStyleInput
) -> ExtractSiteStyleResult:
    url = data.url if "://" in data.url else f"https://{data.url}"
    notes: list[str] = []

    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=TIMEOUT_SECONDS, headers=headers
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text
        final_url = str(response.url)

        scraper = _Scraper()
        scraper.feed(html)

        sheet_urls: list[str] = []
        for href in scraper.stylesheets:
            absolute = urljoin(final_url, href)
            if absolute not in sheet_urls:
                sheet_urls.append(absolute)
        sheet_urls = sheet_urls[: max(1, min(data.max_stylesheets, MAX_SHEETS))]

        css_parts = list(scraper.inline_css)
        budget = MAX_CSS_BYTES
        fetched: list[str] = []
        for sheet_url in sheet_urls:
            if budget <= 0:
                notes.append("stylesheet budget exhausted; later sheets were skipped")
                break
            try:
                sheet = await client.get(sheet_url)
                sheet.raise_for_status()
            except httpx.HTTPError as error:
                notes.append(f"could not fetch {sheet_url}: {type(error).__name__}")
                continue
            text = sheet.text[:budget]
            budget -= len(text)
            css_parts.append(text)
            fetched.append(sheet_url)

    css = "\n".join(css_parts)
    colors, families, radii, properties, faces = _harvest(css)

    mapping = _property_map(properties)
    families = [_resolve(family, mapping) for family in families]
    radii = [_resolve(radius, mapping) for radius in radii]
    # The properties that resolve to an actual colour are the palette, as the
    # site's own authors named it. This is the single most useful thing here.
    palette = [
        f"--{name}: {_normalise_color(_resolve(value, mapping))}"
        for name, value in sorted(mapping.items())
        if _is_color(_resolve(value, mapping))
    ]

    # A var() we could not resolve is defined in a sheet we never fetched, or
    # set on the element. Static CSS cannot reach it — a browser's computed
    # styles can. Naming the exact tokens turns a dead end into the caller's
    # next instruction.
    unresolved = _tally(
        [
            name
            for value in families + radii
            for name in VAR_REFERENCE.findall(value)
            for name in (name[0],)
            if name not in mapping
        ],
        8,
    )
    if unresolved:
        notes.append(
            "unresolved custom properties (read them from computed styles in a browser): "
            + ", ".join(entry.value for entry in unresolved)
        )

    # A page whose markup carries almost no text is a JS shell; the numbers above
    # are then about the framework's defaults, not the brand. Say so loudly —
    # the caller should open a real browser instead of trusting this.
    if scraper.visible_text_length < 400:
        notes.append(
            "page returned little server-rendered text — likely JS-rendered; "
            "re-read it in a real browser before trusting these tokens"
        )
    if not css.strip():
        notes.append("no CSS found at all; the brand must come from the browser or files")

    origin = urlparse(final_url)
    icons = []
    for href in scraper.icons:
        absolute = urljoin(final_url, href)
        if absolute not in icons:
            icons.append(absolute)

    logos: list[LogoCandidate] = []
    seen: set[str] = set()
    for candidate in scraper.logos:
        absolute = urljoin(final_url, candidate.url)
        if absolute not in seen:
            seen.add(absolute)
            logos.append(LogoCandidate(url=absolute, why=candidate.why))
    og_image = scraper.meta.get("og:image", "")
    if og_image:
        absolute = urljoin(final_url, og_image)
        if absolute not in seen:
            logos.append(LogoCandidate(url=absolute, why="og:image (social card, often the lockup)"))

    return ExtractSiteStyleResult(
        ok=True,
        site=SiteMeta(
            url=url,
            final_url=final_url,
            title=scraper.title[:240],
            site_name=scraper.meta.get("og:site_name", "") or origin.netloc,
            description=(scraper.meta.get("description") or scraper.meta.get("og:description", ""))[:500],
            og_image=urljoin(final_url, og_image) if og_image else "",
            theme_color=scraper.meta.get("theme-color", ""),
        ),
        custom_properties=_tally([f"--{name}: {value}" for name, value in properties], 120),
        palette_properties=_tally(palette, 40),
        colors=_tally(colors, 60),
        font_families=_tally(families, 25),
        declared_faces=sorted({face for face in faces if face})[:25],
        radii=_tally(radii, 15),
        logo_candidates=logos[:12],
        icons=icons[:10],
        stylesheets=fetched,
        notes=notes,
    )
