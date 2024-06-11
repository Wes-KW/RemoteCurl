"""This module contains a session class for each logged in session"""

from remotecurl.server.cache import Cache

class Session:

    
    caches: dict[str, Cache] # <url> : <Cache object>

    def __init__(self) -> None:
        pass
