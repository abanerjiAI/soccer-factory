"""Builds the WordPress (Gutenberg) post body from docs/showcase-post.html.

- replaces src="IMG:<file>.png" with the uploaded media URL and adds the wp-image-<id> class
- wraps each top-level element in the matching block comment, so the theme styles it normally
- appends the showcase button block
usage: python tools/build-showcase.py docs/showcase-post.html post-body.html
"""
import html
import json
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]

MEDIA = {
    "soccer-factory-start-soccer.png": (639, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-start-soccer.png"),
    "soccer-factory-examples.png": (640, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-examples.png"),
    "soccer-factory-formations-soccer.png": (652, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-formations-soccer-v3.png"),
    "soccer-factory-layouts-factory.png": (653, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-layouts-factory-v3.png"),
    "soccer-factory-whatif-redcard.png": (654, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-whatif-redcard-v3.png"),
    "soccer-factory-whatif-breakdown.png": (655, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-whatif-breakdown-v3.png"),
    "soccer-factory-lab-soccer.png": (645, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-lab-soccer.png"),
    "soccer-factory-start-factory.png": (646, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-start-factory.png"),
    "soccer-factory-coach-gate.png": (647, "https://nashvilleaiclub.com/wp-content/uploads/sites/4/2026/10/soccer-factory-coach-gate.png"),
}

DEMO = "https://nashvilleaiclub.com/demo/abanerji/soccer-factory/#/examples"
REPO = "https://github.com/abanerjiAI/soccer-factory"

body = open(SRC, encoding="utf-8").read()
body = re.sub(r"<!--.*?-->", "", body, flags=re.S).strip()

TAGS = ("p", "h2", "h3", "ol", "ul", "table", "figure")


def blocks(text: str) -> str:
    out = []
    i = 0
    while True:
        m = re.search(r"<(" + "|".join(TAGS) + r")\b[^>]*>", text[i:])
        if not m:
            break
        tag = m.group(1)
        start = i + m.start()
        open_end = i + m.end()
        depth = 1
        pos = open_end
        while depth:
            nxt = re.search(r"</?" + tag + r"\b", text[pos:])
            if not nxt:
                raise SystemExit(f"unclosed <{tag}> near {text[start:start+80]!r}")
            abs_at = pos + nxt.start()
            depth += -1 if text[abs_at + 1] == "/" else 1
            pos = abs_at + len(tag) + 2
        end = text.index(">", pos - 1) + 1
        out.append(render(tag, text[start:end]))
        i = end
    return "\n\n".join(out)


def render(tag: str, chunk: str) -> str:
    if tag == "p":
        return f"<!-- wp:paragraph -->\n{chunk}\n<!-- /wp:paragraph -->"
    if tag == "h2":
        return f"<!-- wp:heading -->\n{chunk}\n<!-- /wp:heading -->"
    if tag == "h3":
        return f'<!-- wp:heading {{"level":3}} -->\n{chunk}\n<!-- /wp:heading -->'
    if tag in ("ul", "ol"):
        items = re.findall(r"<li>(.*?)</li>", chunk, flags=re.S)
        lis = "\n".join(f"<!-- wp:list-item -->\n<li>{it.strip()}</li>\n<!-- /wp:list-item -->" for it in items)
        attr = "" if tag == "ul" else ' {"ordered":true}'
        opened = chunk[: chunk.index(">") + 1]
        return f"<!-- wp:list{attr} -->\n{opened}\n{lis}\n</{tag}>\n<!-- /wp:list -->"
    if tag == "table":
        inner = re.sub(r"\s+class=\"[^\"]*\"", "", chunk)
        return f'<!-- wp:table -->\n<figure class="wp-block-table">{inner}</figure>\n<!-- /wp:table -->'
    if tag == "figure":
        img = re.search(r'<img src="IMG:([^"]+)"[^>]*alt="([^"]*)"', chunk)
        if not img:
            raise SystemExit(f"figure without IMG: {chunk[:80]}")
        name, alt = img.group(1), img.group(2)
        pid, url = MEDIA[name]
        cap = re.search(r"<figcaption>(.*?)</figcaption>", chunk, flags=re.S)
        caption = f'\n<figcaption class="wp-element-caption">{cap.group(1).strip()}</figcaption>' if cap else ""
        return (
            f'<!-- wp:image {{"id":{pid},"sizeSlug":"large","linkDestination":"media"}} -->\n'
            f'<figure class="wp-block-image size-large"><a href="{url}"><img src="{url}" alt="{html.escape(alt)}" class="wp-image-{pid}"/></a>{caption}</figure>\n'
            f"<!-- /wp:image -->"
        )
    raise SystemExit("unhandled " + tag)


BUTTONS = """
<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button {"linkTarget":"_blank","rel":"noopener noreferrer","style":{"color":{"background":"#0B63CE","text":"#FFFFFF"},"border":{"radius":"6px"},"spacing":{"padding":{"top":"14px","bottom":"14px","left":"28px","right":"28px"}},"typography":{"fontSize":"17px","fontWeight":"600"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-color has-background wp-element-button" href="__DEMO__" target="_blank" rel="noopener noreferrer" style="border-radius:6px;color:#FFFFFF;background-color:#0B63CE;padding:14px 28px;font-size:17px;font-weight:600">Open Soccer Factory — start with the Worked Examples</a></div>
<!-- /wp:button -->
<!-- wp:button {"linkTarget":"_blank","rel":"noopener noreferrer","className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="__REPO__" target="_blank" rel="noopener noreferrer">Source on GitHub</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
""".replace("__DEMO__", DEMO).replace("__REPO__", REPO).strip()

open(OUT, "w", encoding="utf-8").write(blocks(body) + "\n\n" + BUTTONS + "\n")
print("wrote", OUT, "images:", len(MEDIA))
