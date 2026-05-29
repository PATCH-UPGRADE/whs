# Patch WHS Mitigation Lab

## Build Status

[![CI/CD Pipeline](https://github.com/patch-upgrade/whs/actions/workflows/ci.yml/badge.svg)](https://github.com/patch-upgrade/whs/actions/workflows/ci.yml)

## Description

The WHS mitigation lab provides an environment for people to explore emulated and real medical devices, search them for vulnerabilities, apply mitigations, and evaluate those mitigations.

The environment is deployed as a Podman container and is designed to host both virtual machines and containers behind a simple lab network.

## Current Status

Today, the WHS mitigation lab provides access to VMs for both x86 and arm64 on a relatively simple network. This is a proof of concept focused primarily on validating the web interface, the container deployment, and some of the internal infrastructure.

In the near future, we will add support for more complicated network topologies, native architecture containers, and a variety of network introspection and mitigation approaches that will assist in medical device vulnerability exploration. These include:

- Support for mirroring traffic to a particular network segment or device
- Support for adding a bit-in-the-wire device between network segments or between devices that can inspect and modify network traffic
- Support for adding real devices to network segments so that the environment can be used to probe and investigate real devices
- Replay capabilities for injecting traffic
- Traffic characterization and identification capabilities
- Firewall capabilities

## Quick Start

See [Dependencies](#dependencies) first for trools equired by the WHS Mitigation Lab.

The easiest way to start the mitigation lab is to install the `whs` launcher with `pip` or `pipx`, then run the script:

```bash
python3 -m pip install git+https://github.com/patch-upgrade/whs
whs start
```

If you prefer `pipx`, install it once and use:

```bash
pipx install git+https://github.com/patch-upgrade/whs
whs start
```

The launcher pulls `ghcr.io/patch-upgrade/whs:latest`, starts the lab container, and exposes the web interface on port `8080`.

After startup, open `http://localhost:8080` to access the web UI.

If you want a separate lab instance name, use:

```bash
whs start --name my-whs
```


Linux users can also run the Podman image labels directly. These runlabel options are Linux-only and are not the recommended path for macOS or Windows:

```bash
podman container runlabel run_whs ghcr.io/patch-upgrade/whs:latest
```

## Dependencies

You need these tools before starting the mitigation lab:

- Python 3.10 or newer
- Git
- Podman

### Debian/Ubuntu

Install Python, Git, and Podman from the system packages:

```bash
sudo apt update
sudo apt install -y python3 python3-pip pipx git podman
```

Then install and start the lab using the quickstart instructions.

If you plan to use Podman runlabels directly, Python and Git are not required.

### Windows

Install:

- [Python 3.10 or newer](https://www.python.org/downloads/windows/)
- [Git for Windows](https://gitforwindows.org/)
- [Podman Desktop for Windows](https://podman-desktop.io/downloads/windows) or the [Podman Windows install guide](https://podman.io/docs/installation#windows)

On Windows, we want Podman running inside a rootful virtual machine so nested virtualization is available for the lab VMs. The `whs start` command is the preferred way to launch the lab on Windows.

Typical flow:

```powershell
py -m pip install git+https://github.com/patch-upgrade/whs
whs start
```


### Mac

Install:

- [Python 3.10 or newer](https://www.python.org/downloads/macos/)
- Git for macOS. Apple ships command line developer tools that include Git, or you can install the current version from the [official Git for macOS instructions](https://git-scm.com/download/mac).
- [Podman Desktop for macOS](https://podman-desktop.io/downloads/macos) or the [Podman macOS install guide](https://podman.io/docs/installation#macos)

On macOS, we want Podman running inside a rootful virtual machine so the lab can host nested virtualization cleanly. The `whs start` command is the preferred way to launch the lab on macOS.

Typical flow:

```bash
python3 -m pip install git+https://github.com/patch-upgrade/whs
whs start
```


## Working With The Running Lab

This command creates a container called `whs` and a volume called `whs`, so data stored in the mitigation lab is not lost when the container is deleted or updated.

You can attach to the running container with:

```bash
podman attach whs
```

This container runs a [tmux](https://github.com/tmux/tmux/wiki) session. In the first tmux window is a [Carthage](https://github.com/Hadron/carthage) console, which is a modified Python environment that can be used to perform infrastructure-as-code operations on the environment.

When attaching, detach cleanly instead of sending `Ctrl+C` to the session. Because `podman attach` connects to the container's main process, interrupting that session will stop the running service.

You can open additional tmux windows to interact with the environment, including networking, virtual machines, and containers. Containers are run in an interior Podman environment running entirely within the WHS mitigation container itself. Virtual machines are run using libvirt, so normal commands such as [`virsh`](https://libvirt.org/manpages/virsh.html) will work.

## Container Requirements

The WHS mitigation lab container makes the following assumptions:

- The `/dev/kvm` device is available and the user has access to it
- There is a volume mounted on `/srv/whs` where data can be stored
- Port `8080` is exposed to the outer environment
- The container is designed to run as a privileged container in a non-root user namespace; this provides some security isolation, although obviously not as much as a more restricted environment

The reasons that a fair number of privileges are required include:

- Access to `/dev/kvm` requires that the device be mounted in the container and that the cgroups controller permit access
- Setting up containers, networks, and namespaces tends to require a large number of capabilities, including `CAP_NET_ADMIN`, `CAP_NET_RAW`, `CAP_SYS_ADMIN`, and DAC override capabilities
- There need to be sufficient sub-UIDs and sub-GIDs available to run interior containers

## Contributions

We look forward to collaborating on this project and accepting contributions and updates to improve the quality of the work. Please feel free to open issues or pull requests at [patch-upgrade/whs](https://github.com/patch-upgrade/whs).
