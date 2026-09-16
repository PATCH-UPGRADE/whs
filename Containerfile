FROM ghcr.io/hadron/carthage-libvirt:latest
RUN --mount=type=tmpfs,target=/var/lib/apt/lists \
    --mount=type=tmpfs,target=/var/cache/apt \
    apt update && apt install -y qemu-system-arm qemu-system-x86 qemu-efi-aarch64
COPY layout/container_config.yml /layout/config.yml
EXPOSE 8080
COPY layout /app/layout
RUN --mount=type=tmpfs,target=/var/lib/apt/lists \
    --mount=type=tmpfs,target=/var/cache/apt \
    carthage --pull-plugins --config /layout/config.yml install_dependencies
COPY dist /app/dist
COPY container/network /etc/systemd/network
COPY container/subuid /etc/subuid
COPY container/subgid /etc/subgid
COPY container/00-search.conf /etc/containers/registries.conf.d
COPY container/containers.conf  /etc/containers/containers.conf
COPY container/storage.conf /etc/containers/storage.conf
LABEL run_whs 'podman run -d -ti --privileged -p 8080:8080 --group-add=keep-groups -v$NAME:/srv/whs --name $NAME $IMAGE'
LABEL develop_whs 'podman run -d -ti --privileged -p 8080:8080 --group-add=keep-groups -v${PWD}:/app -v$NAME:/srv/whs --name $NAME $IMAGE'
VOLUME /srv/whs
