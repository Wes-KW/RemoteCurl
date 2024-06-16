"""This file contains a module to serve request"""


from http.server import ThreadingHTTPServer
from remotecurl.common.config import Conf
from remotecurl.server.handler import RedirectHandler


__CONFIG__ = Conf()
__SERVER_SCHEME__ = __CONFIG__.server.scheme
__SERVER_PORT__ = __CONFIG__.server.port


def main():
    try:
        with ThreadingHTTPServer(("0.0.0.0", __SERVER_PORT__), RedirectHandler) as server:
            server.serve_forever()
    except KeyboardInterrupt:
        print("^C pressed. Stopping server.")
        server.socket.close()


if __name__ == "__main__":
    main()
