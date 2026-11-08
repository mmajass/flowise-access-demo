#!/usr/bin/env bash
set -euo pipefail

container_id=""
cleanup() {
  if [ -n "$container_id" ]; then
    docker rm -f "$container_id" >/dev/null
  fi
}
trap cleanup EXIT

container_id="$(docker run -d -p 127.0.0.1:33001:3000 \
  -e DISABLE_FLOWISE_TELEMETRY=true flowiseai/flowise:3.1.4)"

for i in $(seq 1 90); do
  if curl --silent --fail http://127.0.0.1:33001/api/v1/ping >/dev/null; then
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$container_id")" != "true" ]; then
    echo "Flowise exited before becoming ready" >&2
    docker logs "$container_id"
    exit 1
  fi
  if [ "$i" = 90 ]; then
    echo "Flowise did not become ready" >&2
    docker logs "$container_id"
    exit 1
  fi
  sleep 2
done

node demo.mjs
