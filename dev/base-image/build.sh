#!/usr/bin/env bash

# Default version if not set
VERSION=${VERSION:-"latest"}

docker build \
    -t hardcoreeng/base:${VERSION} \
    -t ghcr.io/hcengineering/base:${VERSION} \
    -f base.Dockerfile ${DOCKER_EXTRA} .
docker build \
    -t hardcoreeng/rekoni-base:${VERSION} \
    -t ghcr.io/hcengineering/rekoni-base:${VERSION} \
    -f rekoni.Dockerfile ${DOCKER_EXTRA} .
docker build \
    -t hardcoreeng/print-base:${VERSION} \
    -t ghcr.io/hcengineering/print-base:${VERSION} \
    -f print.Dockerfile ${DOCKER_EXTRA} .
docker build \
    -t hardcoreeng/front-base:${VERSION} \
    -t ghcr.io/hcengineering/front-base:${VERSION} \
    -f front.Dockerfile ${DOCKER_EXTRA} .
