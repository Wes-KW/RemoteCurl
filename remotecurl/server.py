from __future__ import annotations
from typing import Any
from io import BytesIO
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from certifi import where as cert_where
from re import search
from util import check_args, get_absolute_path
import pycurl

__SERVER_SCHEME__ = "http"
__SERVER_NAME__ = "localhost"
__SERVER_PORT__ = 5678
__ALLOW_URLS__ = ["^https?://", "^about:blank$", "^data:image/"]
__DENY_URLS__ = ["^https?://localhost", "^https?://127.0.0.1"]
__DENY_HEADERS__ = ["^(host|user-agent|accept-encoding)$"] 

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
        if search("^data:image/", relative_url) is None:
            return self._base_url + get_absolute_path(absolute_url, relative_url)
        else:
            return relative_url

    def _modify_css(self, css: bytes, url: str, encoding: str) -> bytes:
        """DOCSTRING"""
        ...

    def _modify_html(self, html: bytes, url: str, encoding: str) -> bytes:
        """DOCSTRING"""
        document = BeautifulSoup(html.decode(encoding), 'html.parser')

        redirect_script = document.new_tag("script")
        redirect_script.string = """
            /* Redirect script to REMOTECURL */

            (function(){
                function get_absolute_path(relative_path) {
                    var origin = "%(url)s";
                    return new URL(relative_path, origin).href;
                }
                
                window.XMLHttpRequest.prototype._open = window.XMLHttpRequest.prototype.open;
                window.XMLHttpRequest.prototype.open = function(method, url, async=true) {
                    var base_url = "%(base_url)s";
                    var abs_url = base_url + get_absolute_path(url);
                    console.log("XMLHttpRequest: Redirect " + url + " to " + abs_url);
                    this._open(method, abs_url, async);
                };

                window._fetch = window.fetch;
                window.fetch = function(url, options) {
                    while (typeof url !== "string" && "url" in url) {
                        url = url.url;
                    }

                    var base_url = "%(base_url)s";
                    var abs_url = base_url + get_absolute_path(url);
                    console.log("Fetch: Redirect " + url + " to " + abs_url);

                    return window._fetch(abs_url, options)
                    .then(response => {
                        return response;
                    })
                }

            })();
        """ % {"url": url, "base_url": self._base_url}
        if document.__getattr__("head") is not None:
            document.head.insert(0, redirect_script)

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

        return document.prettify(encoding)

    def _request_with_curl(self, url: str) -> dict[str, Any]:
        """DOCSTRING"""

        try:
            self._response_headers = {}
            hlist, hdict = self.get_requested_headers(url)

            buffer = BytesIO()
            c = pycurl.Curl()
            c.setopt(pycurl.URL, url)
            c.setopt(pycurl.HTTPHEADER, hlist)
            c.setopt(pycurl.WRITEFUNCTION, buffer.write)
            c.setopt(pycurl.USERAGENT, hdict["user-agent"])
            c.setopt(pycurl.HEADERFUNCTION, self._header_func)
            c.setopt(pycurl.FOLLOWLOCATION, True)
            c.setopt(pycurl.CAINFO, cert_where())
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
                if "text/html" in content_type:
                    matched = search("charset=(\S+)", content_type)
                    encoding = "utf-8"
                    if matched:
                        encoding = matched.group(1)

                    res["content"] = self._modify_html(buffer.getvalue(), url, encoding)

            c.close()
            return res
        except Exception as e:
            raise e

    def send_head(self) -> bytes:
        """Common code for HEAD and GET request"""
        url = self.get_requested_url()
        if not check_args(url, allow_rules=__ALLOW_URLS__, deny_rules=__DENY_URLS__):
            return

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
