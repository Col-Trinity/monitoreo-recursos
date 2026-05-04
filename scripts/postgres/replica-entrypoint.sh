#!/bin/bash
set -e

# Named Docker volumes are created as root:root. Fix ownership so pg_basebackup
# (which runs as postgres) can write to the data directory.
chown -R postgres:postgres "$PGDATA"
chmod 0700 "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "pg_basebackup: syncing from primary..."
  until gosu postgres pg_basebackup \
      --pgdata="$PGDATA" \
      --wal-method=stream \
      -R \
      --slot=replica_slot \
      --host=postgres \
      --port=5432 \
      --username=replicator; do
    echo "Waiting for primary to be ready..."
    sleep 2
  done
  echo "pg_basebackup: done."
fi

exec gosu postgres postgres -c hot_standby=on
