"""This file contain a HTML modifier class"""


from typing import Optional
from bs4 import BeautifulSoup as dom
from jsmin import jsmin
from re import Match, search, sub
from urllib.parse import urlparse
from remotecurl.modifier.abstract import Modifier
from remotecurl.modifier.css import CSSModifier
from remotecurl.common.util import get_script, remove_quote


class HTMLModifier(Modifier):
    """ A HTML Modifier
    TODO: change common.js -> get_absolute_url such that href of
    TODO: <base> element is considered. <head>
    """

    server_url: str
    document: dom

    def __init__(
        self, html: bytes, url: str, base_url: str, server_url: str, encoding: Optional[str] = None,
        allow_url_rules: list[str] = ["^(.*)$"], deny_url_rules: list[str] = []
    ) -> None:
        """Initialize a HTML modifier"""
        self.server_url = server_url
        self.document = dom(html.decode(encoding), "html.parser")
        super().__init__(url, base_url, encoding, allow_url_rules, deny_url_rules)

    def _py_regex_list_to_js(self, regex_list: list[str]) -> str:
        """Helper function of _add_script. Return a list of regex in javascript string format"""
        js_regex_list = [f"/{str.replace(rule, '/', '\\/')}/i" for rule in regex_list]
        return f"[{", ".join(js_regex_list)}]"

    def _add_script(self) -> None:
        """Add script to the html document"""
        if self.document.head is not None:
            script =self.document.new_tag("script")
            script.attrs["type"] = "text/javascript"
            script.attrs["id"] = "remotecurl"
            script_names = ["common", "request", "navigation"]
            script_embedded = ""
            for script_name in script_names:
                script_embedded += get_script(script_name)

            js_allow_url_rules = self._py_regex_list_to_js(self.allow_url_rules)
            js_deny_url_rules = self._py_regex_list_to_js(self.deny_url_rules)

            script_content = f"""
                (function(){{
                    const $server_url = "{self.server_url}";
                    const $base_url = "{self.base_url}";
                    const $allow_url = {js_allow_url_rules};
                    const $deny_url = {js_deny_url_rules};
                    var $url = "{self.url}";

                    {script_embedded}

                    if (document.querySelector("#remotecurl") !== null) {{
                        document.head.removeChild(document.querySelector("#remotecurl"));   
                    }}
                }})();
            """

            script_content = jsmin(script_content, quote_chars="'\"`")
            script.string = script_content
            self.document.head.insert(0, script)

    def _add_icon(self) -> None:
        """DOCSTRING"""
        if self.document.head is not None:
            icon_doms = self.document.select("link[rel='*icon']")
            if len(icon_doms) == 0:
                url_obj = urlparse(self.url)
                icon_dom = self.document.new_tag("link")
                icon_dom["rel"] = "icon"
                icon_dom["href"] = f"{url_obj.scheme}://{url_obj.hostname}/favicon.ico"
                self.document.head.append(icon_dom)

    def _modify_html_link(self) -> None:
        """DOCSTRING"""
        with_objs_list = [
            {"selector": "*[href]", "attribute": "href"},
            {"selector": "*[src]", "attribute": "src"},
            {"selector": "form[action]", "attribute": "action"},
        ]

        for with_objs in with_objs_list:
            selector = with_objs["selector"]
            attribute = with_objs["attribute"]
            for with_obj in self.document.select(selector):
                with_obj[attribute] = self._modify_link(with_obj.get(attribute))

    def _modify_html_css_background(self) -> None:
        """DOCSTRING"""
        for with_obj in self.document.select("*[style^='background-image']"):
            style_str = with_obj.get("style")
            pattern = r"background(-image)?\ *:\ *url\(([^)]+)\)"
            matched = search(pattern, style_str)
            if matched:
                url = remove_quote(matched.group(2))
                front, back = style_str.split(url, 1)
                url = self._modify_link(url)
                with_obj["style"] = front + url + back

    def _get_new_url_string(self, mobj: Match) -> str:
        """DOCSTRING"""
        mstr = str(mobj.group(0))
        if mstr.endswith("x") and mstr[:-1].isdigit():
            return mstr
        else:
            return self._modify_link(mstr)

    def _modify_html_srcset(self) -> None:
        """DOCSTRING"""
        for with_obj in self.document.select("*[srcset]"):
            srcset = with_obj.get("srcset")
            srcset = sub(r"(data:image/[^\s,]+,[^\s,]*|[^,\s]+)", self._get_new_url_string, srcset)
            with_obj["srcset"] = srcset

    def _modify_html_css(self) -> None:
        """DOCSTRING"""
        for with_obj in self.document.select("style"):
            style = with_obj.string.encode(self.encoding)
            style_modifier = CSSModifier(
                style, self.url,
                self.base_url,
                self.encoding,
                self.allow_url_rules,
                self.deny_url_rules
            )
            with_obj.string = style_modifier.get_modified_content().decode(self.encoding)

    def get_modified_content(self) -> bytes:
        """Return a tuple of html content bytes and encoding"""
        self._add_script()
        self._add_icon()
        self._modify_html_link()
        self._modify_html_css_background()
        self._modify_html_srcset()
        self._modify_html_css()
        return str(self.document).encode(self.encoding)
