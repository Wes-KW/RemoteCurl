"""This file contains a module to handle request"""


from io import BytesIO
from http.server import BaseHTTPRequestHandler
from certifi import where as cert_where
from urllib.parse import urlparse
from re import search
from traceback import format_exc
from remotecurl.modifier.html import HTMLModifier
from remotecurl.modifier.css import CSSModifier
from remotecurl.common.config import Conf
from remotecurl.common.util import check_args, get_absolute_url
import pycurl as curl
import zlib
import brotli
import zstd


__CONFIG__ = Conf()
__SERVER_SHEME__ = __CONFIG__.server.scheme
__SERVER_NAME__ = __CONFIG__.server.name
__SERVER_PORT__ = __CONFIG__.server.port
__SERVER_PATH__ = __CONFIG__.server.path
__ALLOW_URL_RULES__ = __CONFIG__.server.rules.url.allow
__DENY_URL_RULES__ = __CONFIG__.server.rules.url.deny
__DEBUG__ = __CONFIG__.server.debug


# derived constant

if (
    __SERVER_PORT__ == 80 and __SERVER_SHEME__ == "http" or
    __SERVER_PORT__ == 443 and __SERVER_SHEME__ == "https"
):
    __SERVER_URL__ = f"{__SERVER_SHEME__}://{__SERVER_NAME__}/"
else:
    __SERVER_URL__ = f"{__SERVER_SHEME__}://{__SERVER_NAME__}:{__SERVER_PORT__}/"

__BASE_URL__ = f"{__SERVER_URL__}{__SERVER_PATH__[1:]}"


CURL_GET = 0
CURL_HEAD = 1
CURL_POST = 2
CURL_PUT = 3
CURL_OPTIONS = 4
CURL_PATCH = 5
CURL_TRACE = 6
CURL_DELETE = 7


class _HeaderContainer(dict):

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
    """ Redirect Server Handle
    TODO: implement the following http request methods
    TODO:   - PUT, PATCH, TRACE, DELETE, CONNECT
    TODO: also implement uploading file in POST requests
    """

    def get_requested_url(self) -> str:
        """Return the url requested by user"""
        return self.path[len(__SERVER_PATH__):]

    def get_request_headers(self) -> tuple[dict[str, str], list[str]]:
        """Return the requested headers"""
        headers = _HeaderContainer()
        for header in self.headers.as_string().splitlines():
            headers.append(header)
        
        if "host" in headers:
            requested_url = self.get_requested_url()
            requested_url_obj = urlparse(requested_url)
            headers["host"] = requested_url_obj.hostname
        
        if "referer" in headers:
            referer_url = headers["referer"][len(__BASE_URL__):]
            referer_url_obj = urlparse(referer_url)
            ref_hostname = referer_url_obj.hostname
            ref_scheme = referer_url_obj.scheme
        
            headers["referer"] = f"{ref_scheme}://{ref_hostname}/"

            if "origin" in headers:
                headers["origin"] = f"{ref_scheme}://{ref_hostname}"

        return headers.to_dict(), headers.to_list()

    def get_uncompressed_data(self, data: bytes, content_encoding: str) -> bytes:
        """DOCSTRING"""
        if content_encoding == "gzip":
            return zlib.decompress(data, 16 + zlib.MAX_WBITS)
        elif content_encoding == "deflate":
            return zlib.decompress(data, -zlib.MAX_WBITS)
        elif content_encoding == "br":
            return brotli.decompress(data)
        elif content_encoding == "zstd":
            return zstd.decompress(data)
        else:
            raise Exception(f"Unable to decompress content encoded with: {content_encoding}")

    def get_compressed_data(self, data: bytes, content_encoding: str) -> bytes:
        """DOCSTRING"""
        if content_encoding == "gzip":
            return zlib.compress(data, zlib.DEFLATED, 16 + zlib.MAX_WBITS)
        elif content_encoding == "deflate":
            return zlib.compress(data, zlib.DEFLATED, -zlib.MAX_WBITS)
        elif content_encoding == "br":
            return brotli.compress(data)
        elif content_encoding == "zstd":
            return zstd.compress(data)
        else:
            raise Exception(f"Unable to compress content encoded with: {content_encoding}")

    def do_curl(self, option: int = CURL_GET) -> None:
        """
        Make a request through curl and return the responded content as bytes"

        TODO: add code to handle POST file in POST request
        TODO: add code to handle PUT request
        TODO: add code to check CSP before loading
        """

        url = self.get_requested_url()

        if not check_args(url, __ALLOW_URL_RULES__, __DENY_URL_RULES__):
            self.send_response_only(403)
            self.send_header("content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"DENIED_ACCESS_TO_URL")
            return

        try:
            hdict, hlist = self.get_request_headers()
            buffer = BytesIO()
            response_headers = _HeaderContainer()

            c = curl.Curl()
            c.setopt(curl.URL, url)
            c.setopt(curl.HTTPHEADER, hlist)
            c.setopt(curl.HEADERFUNCTION, response_headers.append)
            c.setopt(curl.WRITEFUNCTION, buffer.write)
            c.setopt(curl.CAINFO, cert_where())
            c.setopt(curl.TIMEOUT, 30)

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

            data = buffer.getvalue()

            # Modify content or response headers
            if http_code == 302 and "location" in response_headers:
                response_headers["location"] = __BASE_URL__ + get_absolute_url(url, response_headers["location"])
            
            if "content-security-policy" in response_headers:
                response_headers.pop("content-security-policy")

            if "content-security-policy-report-only" in response_headers:
                response_headers.pop("content-security-policy-report-only")

            if "cross-origin-opener-policy" in response_headers:
                response_headers.pop("cross-origin-opener-policy")

            if "cross-origin-opener-policy-report-only" in response_headers:
                response_headers.pop("cross-origin-opener-policy-report-only")

            if "cross-origin-embedder-policy" in response_headers:
                response_headers.pop("cross-origin-embedder-policy")

            if "cross-origin-embedder-policy-report-only" in response_headers:
                response_headers.pop("cross-origin-embedder-policy-report-only")

            if "content-type" in response_headers:
                content_type = response_headers["content-type"]
                encoding = "utf-8"
                matched = search(r"charset=(\S+)", content_type)
                if matched:
                    encoding = matched.group(1)

                rewrite_required = any(x in content_type for x in ["text/html", "text/css"])

                if rewrite_required:
                    # Decompress before making changes
                    if "content-encoding" in response_headers:
                        data = self.get_uncompressed_data(data, response_headers["content-encoding"])

                if "text/html" in content_type:
                    m = HTMLModifier(
                        data, url, __BASE_URL__, __SERVER_URL__,
                        encoding, __ALLOW_URL_RULES__, __DENY_URL_RULES__
                    )
                    data = m.get_modified_content()
            
                if "text/css" in content_type:
                    m = CSSModifier(
                        data, url, __BASE_URL__, encoding,
                        __ALLOW_URL_RULES__, __DENY_URL_RULES__
                    )
                    data = m.get_modified_content()
            
                if rewrite_required:
                    # Compress after changes          
                    if "content-encoding" in response_headers:
                        data = self.get_compressed_data(data, response_headers["content-encoding"])
            
                    if "content-length" in response_headers:
                        response_headers["content-length"] = str(len(data))

            if "transfer-encoding" in response_headers:
                if response_headers["transfer-encoding"] == "chunked":
                    response_headers.pop("transfer-encoding")
                    response_headers["content-length"] = str(len(data))

            self.send_response_only(http_code)
            for key, value in response_headers.to_dict().items():
                self.send_header(key, value)
            self.end_headers()

            self.wfile.write(data)

        except Exception:
            try:
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
            except:
                # bypass broken pip error
                pass

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
