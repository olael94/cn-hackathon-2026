import argparse
import sys

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m roompass")
    parser.add_argument("process", choices=["api", "pipeline", "translator"])
    process = parser.parse_args().process

    if process == "api":
        uvicorn.run("roompass.api:app", host="0.0.0.0", port=8000)
    else:
        sys.exit(f"roompass {process}: not built yet (phase 02)")


if __name__ == "__main__":
    main()
