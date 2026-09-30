#!/bin/sh
set -eu
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="/backups/capuchoo-${stamp}.dump"
pg_dump --format=custom --compress=6 --no-owner --file="${target}.part"
mv "${target}.part" "${target}"
find /backups -name 'capuchoo-*.dump' -mtime "+${KEEP_DAYS:-14}" -delete
echo "backup written: ${target}"
