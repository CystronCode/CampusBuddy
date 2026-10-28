import argparse
import time
from backend.app.db import SessionLocal, initialize_local
from backend.app.ingestion import work_once


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    initialize_local()
    while True:
        worked = work_once(SessionLocal)
        if args.once:
            break
        if not worked:
            time.sleep(2)


if __name__ == "__main__":
    main()
