from carthage import *
from carthage import podman
from carthage.modeling import *


#: nftables ruleset applied by the router image's boot unit.  The default
#: FORWARD policy is left as ACCEPT (no filtering yet); the only rule is
#: masquerading for the upstream interface.  ``eth0`` is the container's
#: default podman network interface (see ``--network=podman`` on upstream
#: routers in :mod:`python.topology`); ``oifname`` matches by name so the
#: rule loads regardless of interface state at boot.
NFTABLES_RULES = '''\
table ip whs_router {
    chain postrouting {
        type nat hook postrouting priority srcnat;
        oifname "eth0" masquerade
    }
}
'''

#: systemd unit that loads the ruleset on every boot.  ``After=`` orders
#: against networkd starting (the network links themselves do not need to be
#: up — ``oifname`` matches by name).
NFTABLES_UNIT = '''\
[Unit]
Description=Load WHS router nftables ruleset
After=systemd-networkd.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/nftables/whs_router.nft

[Install]
WantedBy=multi-user.target
'''

class WhsRouter(podman.PodmanImageModel):
    '''Podman image for use as a router in the lab'''''
    add_provider(podman.podman_container_host, podman.LocalPodmanContainerHost)
    override_dependencies = True
    from carthage.libvirt.images import NoRootCustomization, SerialCustomization

    class install_prereqs(FilesystemCustomization):
        @setup_task('Install systemd')
        async def install_base_packages(self):
            await self.run_command("apt", "update")
            await self.run_command("apt", "-y", "install", "systemd-sysv")

    class install_nftables(FilesystemCustomization):
        '''Install nftables and wire it up to run on every boot.

        The ruleset (masquerade out the upstream ``eth0``) is baked into the
        image and re-applied by an enabled oneshot unit at each container
        start, so the rules survive reboots without any host-side
        intervention.
        '''
        description = "Install nftables with a per-boot masquerade ruleset"

        @setup_task('Install nftables and boot-time ruleset')
        async def install_nftables(self):
            await self.run_command("apt", "update")
            await self.run_command("apt", "-y", "install", "nftables")
            (self.path / 'etc/nftables').mkdir(parents=True, exist_ok=True)
            (self.path / 'etc/nftables/whs_router.nft').write_text(NFTABLES_RULES)
            (self.path / 'etc/systemd/system/whs-router-nftables.service').write_text(
                NFTABLES_UNIT)
            # Offline enable: writes the wants/ symlink; does not require a
            # running PID 1 in the build container.
            await self.run_command("systemctl", "enable", "whs-router-nftables.service")

    oci_image_tag = 'localhost/whs-router'
    base_image = 'debian:trixie'
    oci_image_command = ['/sbin/init']
