# The swaylock environment for pnpm verify and pnpm render: swaylock on
# headless sway, with wtype to type into it.
#   ubuntu:24.04 ships swaylock 1.7.2, ubuntu:26.04 swaylock 1.8.4.
ARG BASE=ubuntu:26.04
FROM ${BASE}
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      swaylock sway wtype grim imagemagick fonts-jetbrains-mono ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# The containers run as the host's uid and gid (docker.ts): give them a user
# and group, which swaylock's PAM check looks up. ubuntu
# images have uid 1000 already; a CI runner is 1001.
ARG UID=1000
ARG GID=1000
RUN getent group "$GID" >/dev/null || groupadd -g "$GID" mistpine \
 && { getent passwd "$UID" >/dev/null || useradd -u "$UID" -g "$GID" -M -d /tmp/home mistpine; }
