"""This file contains a module to handle request"""

from typing import Any
from io import BytesIO
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from certifi import where as cert_where
from urllib.parse import urlparse
from traceback import format_exc
from remotecurl.common.config import Conf
from remotecurl.common.util import check_args
import pycurl as curl


__CONFIG__ = Conf()
__SERVER_SCHEME__ = __CONFIG__.server.scheme
__SERVER_NAME__ = __CONFIG__.server.name
__SERVER_PORT__ = __CONFIG__.server.port
__SERVER_PATH__ = __CONFIG__.server.path
__ALLOW_URL_RULES__ = __CONFIG__.server.rules.url.allow
__DENY_URL_RULES__ = __CONFIG__.server.rules.url.deny
__DEBUG__ = __CONFIG__.server.debug


CURL_GET = 0
CURL_HEAD = 1
CURL_POST = 2
CURL_PUT = 3
CURL_OPTIONS = 4
CURL_PATCH = 5
CURL_TRACE = 6


class HeaderContainer(dict):

    header_lines: list[str]

    def __init__(self, *args, **kwargs) -> None:
        """Initialize a HeaderContainer"""
        self.header_lines = []
        super().__init__(*args, **kwargs)

    def __setitem__(self, key: str, value: str) -> None:
        """Set header property"""
        super().__setitem__(key.strip().lower(), value.strip())

    def __contains__(self, key: str) -> bool:
        return super().__contains__(key.strip().lower())

    def pop(self, key: str) -> str:
        return super().pop(key.lower())

    def append(self, new_header: str | bytes) -> None:
        """Append a new header"""
        if isinstance(new_header, bytes):
            new_header = new_header.decode("iso-8859-1")            

        new_header = new_header.strip()
        if ":" in new_header:
            key, value = new_header.split(":", 1)
            self.__setitem__(key, value)
        else:
            if new_header != "":
                self.header_lines.append(new_header)

    def to_dict(self) -> dict[str, str]:
        """Convert headers to dict"""
        return {key: value for key, value in self.items()}

    def to_list(self) -> list[str]:
        """Convert headers to a list"""
        headers_list = self.header_lines.copy()
        headers_list.extend([f"{key}: {value}" for key, value in self.items()])
        return headers_list

    def to_str(self) -> str:
        """Convert headers to string"""
        return "\n".join(self.to_list())


class RedirectHandler(BaseHTTPRequestHandler):
    """Redirect Server Handle"""

    def get_requested_url(self) -> str:
        """Return the url requested by user"""
        return self.path[len(__SERVER_PATH__):]

    def get_requst_headers(self) -> tuple[dict[str, str], list[str]]:
        """Return the requested headers"""
        headers = HeaderContainer()
        for header in self.headers.as_string().splitlines():
            headers.append(header)

        if "host" in headers:
            headers["host"] = urlparse(self.get_requested_url()).hostname

        if "accept-encoding" in headers:
            headers.pop("accept-encoding")

        return headers.to_dict(), headers.to_list()

    def do_curl(self, option: int = CURL_GET) -> None:
        """
        Make a request through curl and return the responded content as bytes"

        TODO: add code to handle POST file in POST request
        TODO: add code to handle PUT request
        """

        url = self.get_requested_url()

        if not check_args(url, __ALLOW_URL_RULES__, __DENY_URL_RULES__):
            self.send_response_only(403)
            self.send_header("content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"DENIED_ACCESS_TO_URL")
            return

        try:
            hdict, hlist = self.get_requst_headers()
            buffer = BytesIO()
            response_headers = HeaderContainer()

            c = curl.Curl()
            c.setopt(curl.URL, url)
            c.setopt(curl.HTTPHEADER, hlist)
            c.setopt(curl.HEADERFUNCTION, response_headers.append)
            c.setopt(curl.WRITEFUNCTION, buffer.write)
            c.setopt(curl.CAINFO, cert_where())

            if option == CURL_HEAD:
                c.setopt(curl.NOBODY, True)

            if option == CURL_POST:
                # POST
                # TODO: Check if file is uploaded to this server,
                # TODO: If true, upload the file using HTTPPOST
                length = int(self.headers.get("content-length"))
                c.setopt(curl.POSTFIELDS, self.rfile.read(length))

            if option == CURL_OPTIONS:
                # OPTIONS
                c.setopt(curl.CUSTOMREQUEST, "OPTIONS")

            # Change header options
            c.setopt(curl.USERAGENT, hdict["user-agent"])

            # Send the request
            c.perform()

            http_code = c.getinfo(curl.HTTP_CODE)
            c.close()
            
            self.send_response_only(http_code)
            for key, value in response_headers.to_dict().items():
                self.send_header(key, value)
            self.end_headers()

            data = buffer.getvalue()
            self.wfile.write(data)

        except Exception:
            if __DEBUG__:
                self.send_response_only(200)
                self.send_header("content-type", "text/plain")
                self.end_headers()
                self.wfile.write(bytes(format_exc(), "utf-8"))
            else:
                self.send_response(500)
                self.send_header("content-type", "text/plain")
                self.end_headers()
                self.wfile.write(b"")

    def do_GET(self) -> None:
        """Handle get request"""
        self.do_curl(CURL_GET)

    def do_HEAD(self) -> None:
        """Handle head request"""
        self.do_curl(CURL_HEAD)

    def do_POST(self) -> None:
        """Handle post request"""
        self.do_curl(CURL_POST)

    def do_OPTIONS(self) -> None:
        """Handle options request"""
        self.do_curl(CURL_OPTIONS)

def main():
    try:
        with ThreadingHTTPServer(("0.0.0.0", __SERVER_PORT__), RedirectHandler) as server:
            server.serve_forever()
    except KeyboardInterrupt:
        print("^C pressed. Stopping server.")
        server.socket.close()

if __name__ == "__main__":
    main()
