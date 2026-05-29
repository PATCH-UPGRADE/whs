from carthage import *
from carthage import podman
from carthage.modeling import *

class WhsRouter(podman.PodmanImageModel):
    '''Podman image for use as a router in the lab'''
    add_provider(podman.podman_container_host, podman.LocalPodmanContainerHost)
    override_dependencies = True
    from carthage.libvirt.images import NoRootCustomization, SerialCustomization

    class install_prereqs(FilesystemCustomization):
        @setup_task('Install systemd')
        async def install_base_packages(self):
            await self.run_command("apt", "update")
            await self.run_command("apt", "-y", "install", "systemd-sysv")

    oci_image_tag = 'localhost/whs-router'
    base_image = 'debian:trixie'
    oci_image_command = ['/sbin/init']
