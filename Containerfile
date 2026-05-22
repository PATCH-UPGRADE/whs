FROM ghcr.io/hadron/carthage-libvirt:latest
copy layout/container_config.yml /layout/config.yml
EXPOSE 8080
VOLUME /srv/whs
COPY layout /app/layout
RUN --mount=type=tmpfs,target=/var/lib/apt/lists \
    --mount=type=tmpfs,target=/var/cache/apt \
    carthage --config /layout/config.yml install_dependencies
COPY dist /app/dist
COPY container/network /etc/systemd/network
COPY container/subuid /etc/subuid
COPY container/subgid /etc/subgid
COPY container/containers.conf  /etc/containers/containers.conf
RUN podman network create net \
              -d bridge \
              -o com.docker.network.bridge.name=whs-lab \
              --label carthage.layout=whs \
              --subnet 10.20.100.0/24 \
              --gateway 10.20.100.1 \
              -o mode=unmanaged
LABEL run_whs 'podman run -d -ti --privileged -p 8080:8080 --group-add=keep-groups -v$NAME:/srv/whs --name $NAME $IMAGE'
