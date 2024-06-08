from typing import Any

class Result:
    """A session result class"""

    def __init__(self, status: bool, error: str = "", result: Any = None) -> None:
        self.status = status
        self.error = error
        self.result = result

    def to_dict(self) -> dict[str, Any]:
        return {"status": self.status, "error": self.error, "result": self.result}
