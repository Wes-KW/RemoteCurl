"""This module contains modifier classes for modifying links in files"""

from typing import Optional
from re import Match, search, sub, MULTILINE
from bs4 import BeautifulSoup
from remotecurl.common.util import get_script, get_absolute_url, remove_quote

class Modifier:
    """Abstract modifier"""

    url: str # <absolute_url>
    base_url: str # ```base_url = "http(s)://<proxy_server>/<session_id>/<page_id>/"```
    encoding: Optional[str] = None

    def __init__(self, url: str, base_url: str = "", encoding: Optional[str] = None) -> None:
        self.url = url
        self.base_url = base_url
        self.encoding = encoding

    def _modify_link(self, absolute_url: str, relative_url: str) -> str:
        """DOCSTRING"""
        if search("(^data:image\/.*)|(^blob:.*)", relative_url):
            return relative_url
        else:
            return self.base_url + get_absolute_url(absolute_url, relative_url)


class HTMLModifier(Modifier):
    """A HTML modifier"""

    document: BeautifulSoup

    def __init__(self, html: bytes, url: str, base_url: str = "", encoding: Optional[str] = None) -> None:
        """Initialize a HTML Parser"""
        self.document = BeautifulSoup(html.decode(encoding), "html.parser")
        super().__init__(url, base_url, encoding)

    def _add_request_script(self) -> None:
        """Modify javascript redirect links"""
        script = self.document.new_tag("script")
        script.attrs["type"] = "text/javascript"
        scripts = ["common", "link", "navigation", "request"]
        script_content = {f: get_script(f"{f}.js") for f in scripts}
        script.string = f"""
            const $base_url = "{self.base_url}";
            const $url = "{self.url}";
            {script_content}
        """
        if hasattr(self.document, "head"):
            self.document.head.insert(script)

    def _modify_static_html(self) -> None:
        """DOCSTRING"""
        # Modify Links
        with_objs_list = [
            {"selector": "*[href]", "attribute": "href"},
            {"selector": "*[src]", "attribute": "src"},
            {"selector": "form[action]", "attribute": "action"},
        ]

        for with_objs in with_objs_list:
            selector = with_objs["selector"]
            attribute = with_objs["attribute"]
            for with_obj in self.document.select(selector):
                with_obj[attribute] = self._modify_link(self.url, with_obj.get(attribute))

        # Modify srcset
        for with_obj in self.document.select("*[srcset]"):
            modified_srcsets = []
            srcset_string = with_obj.get("srcset")
            srcsets = srcset_string.split(",")
            for srcset in srcsets:
                srcset = srcset.strip()
                if " " not in srcset:
                    modified_srcsets.append(srcset)                    
                else:
                    src, size = srcset.split(" ", 1)
                    src = self._modify_link(self.url, src)
                    modified_srcsets.append(f"{src} {size}")

            with_obj["srcset"] = ", ".join(modified_srcsets)

        # Modify background-image
        for with_obj in self.document.select('*[style^="background-image"]'):
            style_str = with_obj.get("style")
            pattern = "background(-image)?\ *:\ *url\(([^)]+)\)"
            matched = search(pattern, style_str)
            if matched:
                url = remove_quote(matched.group(2))
                front, back = style_str.split(url, 1)
                url = self._modify_link(self.url, url)
                with_obj["style"] = front + url + back

    def get_modified_content(self) -> tuple[bytes, str]:
        """Return a tuple of html content bytes and encoding"""
        self._add_request_script()
        self._modify_static_html()
        return (self.document.prettify(self.encoding), self.encoding)


class CSSModifier(Modifier):
    """A CSS modifier"""

    css: str
    url: str
    base_url: str
    encoding: Optional[str] = None

    def __init__(self, css: bytes, url: str, base_url: str = "", encoding: Optional[str] = None) -> None:
        """Initialize a CSS modifier"""
        self.css = css.decode(encoding) 
        super().__init__(url, base_url, encoding)

    def _get_new_url_string(self, mobj: Match) -> str:
        url = remove_quote(mobj.group(1))
        whole_matched = mobj.group(0)
        front, back = whole_matched.split(url, 1)
        url = self._modify_link(self.url, url)
        return front + url + back

    def _modify_css(self) -> None:
        """Modify css content"""
        self.css = sub(r"url\(([^)]+)\)", self._get_new_url_string, self.css, flags=MULTILINE)

    def get_modified_content(self) -> tuple[bytes, str]:
        """Return a tuple of css content bytes and encoding"""
        self._modify_css()
        return (bytes(self.css, self.encoding), self.encoding)
