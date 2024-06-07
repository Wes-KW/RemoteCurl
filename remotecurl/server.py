from __future__ import annotations
from typing import Any
from io import BytesIO
from bs4 import BeautifulSoup
from cssutils import parseStyle, parseString, log
from http.server import HTTPServer
from http.server import BaseHTTPRequestHandler
from pycurl import Curl, URL, HTTPHEADER, WRITEFUNCTION, USERAGENT, HEADERFUNCTION, FOLLOWLOCATION, CAINFO
from re import search
from urllib.parse import urlparse
from certifi import where as cert_where
from logging import CRITICAL
from traceback import format_exc
from util import check_args, get_absolute_path


__SERVER_SCHEME__ = "http"
__SERVER_NAME__ = "localhost"
__SERVER_PORT__ = 5678
__ALLOW_URLS__ = ["^https?://", "^about:blank$", "^data:image/"]
__DENY_URLS__ = ["^https?://localhost", "^https?://127.0.0.1"]
__DENY_HEADERS__ = ["^(host|user-agent|accept-encoding)$"] 

log.setLevel(CRITICAL)


class HttpProxyHandler(BaseHTTPRequestHandler):
    """Http proxy server handler"""

    _response_headers = {}
    _base_url = f"{__SERVER_SCHEME__}://{__SERVER_NAME__}:{__SERVER_PORT__}/"
    _redirected_url = ""

    def get_requested_url(self) -> str:
        """Return the url requested to load"""
        if self.path.startswith("/"):
            return self.path[1:]

        return ""

    def get_requested_headers(self, url: str) -> tuple[list[str], dict[str]]:
        """DOCSTRING"""
        headers_list = []
        headers_dict = {}
        headers_list.append(f"host: {urlparse(url).hostname}")
        headers_dict["host"] = urlparse(url).hostname

        for header in self.headers.as_string().splitlines() :
            if ":" not in header:
                continue

            key, value = header.split(":", 1)
            key = key.strip().lower()
            value = value.strip()
            headers_dict[key] = value
            if check_args(key, deny_rules=__DENY_HEADERS__):
                headers_list.append(header.lower())

        return headers_list, headers_dict

    def _header_func(self, header: bytes) -> None:
        """DOCSTRING"""
        header = header.decode('iso-8859-1')

        if ":" not in header:
            return

        key, value = header.split(':', 1)
        key = key.strip().lower()
        value = value.strip()
        self._response_headers[key] = value

    def _modify_link(self, absolute_url: str, relative_url: str) -> str:
        """DOCSTRING"""
        if search("(^data:image/.*)|(^blob:.*)", relative_url) is None:
            return self._base_url + get_absolute_path(absolute_url, relative_url)
        else:
            return relative_url

    def _modify_bg_image(self, bgimage_str: str, url: str) -> str:
        """DOCSTRING"""
        matched = search("url\(([^)]+)\)", bgimage_str)
        if matched:
            bgimage_src = matched.group(1)
            front, back = bgimage_str.split(bgimage_src, 1)
            bgimage_src = self._modify_link(url, bgimage_src)
            return front + bgimage_src + back
        else:
            return bgimage_str

    def _modify_css(self, css: bytes, url: str, encoding: str) -> bytes:
        """Return the modified css document, where links are redirected"""
        cssString = css.decode(encoding)
        sheet = parseString(cssString)

        for rule in sheet:
            if rule.type == rule.STYLE_RULE:
                for property in rule.style:
                    if property.name == 'background-image':
                        property.value = self._modify_bg_image(property.value, url)

        return bytes(sheet.cssText.decode('utf-8'), encoding)

    def _modify_html(self, html: bytes, url: str, encoding: str) -> bytes:
        """Return the modified html document, where links are redirected"""
        document = BeautifulSoup(html.decode(encoding), 'html.parser')

        # Add script to redirect
        redirect_script = document.new_tag("script")
        redirect_script.string = """
            /* Redirect script to REMOTECURL */

            (function(){
                function get_absolute_path(relative_path) {
                    /* skip blob and base64 data */
                    var pattern = /(^data:image\/.*)|(^blob:.*)/;
                    if (pattern.test(relative_path)) {
                        return relative_path;
                    } else {
                        var origin = "%(url)s";
                        return "%(base_url)s" + new URL(relative_path, origin).href;   
                    }
                }

                function log(name, original_url, new_url) {
                    console.log(name + ": Redirect " + original_url + " to " + new_url);
                }

                // Reset request
                window.XMLHttpRequest.prototype._open = window.XMLHttpRequest.prototype.open;
                window.XMLHttpRequest.prototype.open = function(method, url, async=true) {
                    var abs_url = get_absolute_path(url);
                    log("XMLHttpRequest", url, abs_url);
                    this._open(method, abs_url, async);
                };

                window._fetch = window.fetch;
                window.fetch = function(url, options) {
                    while (typeof url !== "string" && "url" in url) {
                        url = url.url;
                    }

                    var abs_url = get_absolute_path(url);
                    log("Fetch", url, abs_url);
                    return window._fetch(abs_url, options)
                    .then(response => {
                        return response;
                    });
                }

                // Reset Element link
            })();
        """ % {"url": url, "base_url": self._base_url}
        if document.__getattr__("head") is not None:
            document.head.insert(0, redirect_script)

        # Rewrite links and srcs
        for with_obj in document.select("*[href]"):
            with_obj["href"] = self._modify_link(url, with_obj.get("href"))

        for with_obj in document.select("*[src]"):
            with_obj["src"] = self._modify_link(url, with_obj.get("src"))

        for with_obj in document.select("form[action]"):
            with_obj["action"] = self._modify_link(url, with_obj.get("action"))

        for with_obj in document.select("*[srcset]"):
            modified_srcsets = []
            srcset_string = with_obj.get("srcset")
            srcsets = srcset_string.split(",")
            for srcset in srcsets:
                srcset = srcset.strip()
                if " " not in srcset:
                    modified_srcsets.append(srcset)                    
                else:
                    src, size = srcset.split(" ", 1)
                    src = self._modify_link(url, src)
                    modified_srcsets.append(f"{src} {size}")

            with_obj["srcset"] = ", ".join(modified_srcsets)

        for with_obj in document.select('*[style^="background-image"]'):
            style = parseStyle(with_obj.get("style"))
            bg_image_src = style["background-image"]
            style["background-image"] = self._modify_bg_image(bg_image_src, url)
            with_obj["style"] = style.cssText

        return document.prettify(encoding)

    def _request_encoding(self, content_type: str) -> str:
        """Return response encoding. If no encoding is received, assume utf-8"""
        matched = search("charset=(\S+)", content_type)
        if matched:
            return matched.group(1)

        return "utf-8"

    def _request_with_curl(self, url: str, debug: bool = False) -> dict[str, Any]:
        """DOCSTRING"""

        try:
            self._response_headers = {}
            hlist, hdict = self.get_requested_headers(url)

            buffer = BytesIO()
            c = Curl()
            c.setopt(URL, url)
            c.setopt(HTTPHEADER, hlist)
            c.setopt(WRITEFUNCTION, buffer.write)
            c.setopt(USERAGENT, hdict["user-agent"])
            c.setopt(HEADERFUNCTION, self._header_func)
            c.setopt(FOLLOWLOCATION, True)
            c.setopt(CAINFO, cert_where())
            c.perform()

            res = {}
            self._response_headers["http-code"] = c.getinfo(c.HTTP_CODE)
            res["headers"] = self._response_headers
            res["content"] = buffer.getvalue()

            # Redirect to new url
            if "location" in self._response_headers:
                url = self._response_headers["location"]

            # Modify HTML
            if 'content-type' in res["headers"]:
                content_type = res["headers"]['content-type'].lower()
                encoding = self._request_encoding(content_type)
                if "text/html" in content_type:
                    res["content"] = self._modify_html(buffer.getvalue(), url, encoding)
                elif "text/css" in content_type:
                    res["content"] = self._modify_css(buffer.getvalue(), url, encoding)

            c.close()
            return res
        except Exception:
            output = b""
            if debug:
                output = bytes(format_exc(), "utf-8")

            return {"headers": {"http-code": 500, "content-type": "text/plain"}, "content": output}

    def send_head(self) -> bytes:
        """Common code for HEAD and GET request"""
        url = self.get_requested_url()
        if not check_args(url, allow_rules=__ALLOW_URLS__, deny_rules=__DENY_URLS__):
            return b""

        res = self._request_with_curl(url)
        if "content-type" not in res["headers"]:
           res["headers"]["content-type"] = ""; 

        self.send_response(res["headers"]["http-code"])
        self.send_header('Content-type', res["headers"]["content-type"])
        self.end_headers()

        return res["content"]

    def do_HEAD(self) -> None:
        """Handle HEAD request"""
        self.send_head()

    def do_GET(self):
        """Handle GET request"""
        self.wfile.write(self.send_head())

    def do_POST(self):
        """DOCSTRING"""
        pass

    def do_PUT(self):
        """DOCSTRING"""
        pass

if __name__ == "__main__":
    with HTTPServer(('', __SERVER_PORT__), HttpProxyHandler) as server:
        server.serve_forever()
