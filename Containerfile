FROM ghcr.io/hadron/carthage-libvirt:latest
copy layout/container_config.yml /layout/config.yml
EXPOSE 8080
VOLUME /srv/whs
COPY layout /app/layout
RUN --mount=type=tmpfs,target=/var/lib/apt/lists \
    --mount=type=tmpfs,target=/var/cache/apt \
    carthage --config /layout/config.yml install_dependencies
COPY dist /app/dist
