#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path


BACKUP_RE = re.compile(r"^pe-be-postgres-(\d{8}T\d{6}Z)\.dump(?:\.gpg)?$")


@dataclass(frozen=True)
class Backup:
    path: Path
    created_at: datetime


def parse_backup(path: Path) -> Backup | None:
    match = BACKUP_RE.match(path.name)
    if not match:
        return None

    created_at = datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ").replace(
        tzinfo=UTC
    )
    return Backup(path=path, created_at=created_at)


def newest_per_bucket(
    backups: list[Backup],
    bucket_count: int,
    bucket_key,
) -> set[Path]:
    if bucket_count <= 0:
        return set()

    buckets: dict[object, list[Backup]] = defaultdict(list)
    for backup in backups:
        buckets[bucket_key(backup.created_at)].append(backup)

    newest_keys = sorted(buckets.keys(), reverse=True)[:bucket_count]
    return {max(buckets[key], key=lambda backup: backup.created_at).path for key in newest_keys}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prune PE Backend Postgres dump files with daily/weekly/monthly retention."
    )
    parser.add_argument("backup_dir", type=Path)
    parser.add_argument("--keep-daily", type=int, default=14)
    parser.add_argument("--keep-weekly", type=int, default=8)
    parser.add_argument("--keep-monthly", type=int, default=12)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    backup_dir = args.backup_dir.expanduser()
    if not backup_dir.is_dir():
        raise SystemExit(f"Backup directory does not exist: {backup_dir}")

    backups = [
        backup
        for backup in (parse_backup(path) for path in backup_dir.iterdir())
        if backup is not None
    ]
    backups.sort(key=lambda backup: backup.created_at, reverse=True)

    if not backups:
        print("No backup files found.")
        return 0

    now = datetime.now(UTC)
    recent_floor = now - timedelta(days=args.keep_daily)

    keep: set[Path] = set()
    keep.add(backups[0].path)
    keep.update(
        newest_per_bucket(
            [backup for backup in backups if backup.created_at >= recent_floor],
            args.keep_daily,
            lambda created_at: created_at.date(),
        )
    )
    keep.update(
        newest_per_bucket(
            backups,
            args.keep_weekly,
            lambda created_at: created_at.isocalendar()[:2],
        )
    )
    keep.update(
        newest_per_bucket(
            backups,
            args.keep_monthly,
            lambda created_at: (created_at.year, created_at.month),
        )
    )

    removed_count = 0
    for backup in backups:
        if backup.path in keep:
            continue

        if args.dry_run:
            print(f"Would remove {backup.path}")
        else:
            backup.path.unlink()
            print(f"Removed {backup.path}")
        removed_count += 1

    print(f"Kept {len(keep)} backup file(s); removed {removed_count}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
