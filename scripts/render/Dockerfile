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
