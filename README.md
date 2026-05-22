# Patch WHS Mitigation Lab

## Build Status

[![CI/CD Pipeline](https://github.com/patch-upgrade/whs/actions/workflows/ci.yml/badge.svg)](https://github.com/patch-upgrade/whs/actions/workflows/ci.yml)

## Description

The WHS mitigation lab provides an environment for people to explore emulated and real medical devices, search them for vulnerabilities, apply mitigations, and evaluate those mitigations.

The environment can be deployed as a container, typically a privileged container, so that it has access to accelerated virtualization. The environment can host VMs and containers.

## Current Status

Today, the WHS mitigation lab provides access to VMs for both x86 and arm64 on a relatively simple network. This is a proof of concept focused primarily on validating the web interface, the container deployment, and some of the internal infrastructure.

In the near future, we will add support for more complicated network topologies, x86 containers, and a variety of network introspection and mitigation approaches that will assist in medical device vulnerability exploration. These include:

- Support for mirroring traffic to a particular network segment or device
- Support for adding a bit-in-the-wire device between network segments or between devices that can inspect and modify network traffic
- Support for adding real devices to network segments so that the environment can be used to probe and investigate real devices
- Replay capabilities for injecting traffic
- Traffic characterization and identification capabilities
- Firewall capabilities

## How to Deploy

The mitigation lab environment is intended to be deployed using the [Podman](https://podman.io/) container engine. It is almost certainly possible to deploy it using Docker or even in a Kubernetes cluster, but instructions for doing so are not currently provided.

We use the [Podman runlabel facility](https://docs.podman.io/en/latest/markdown/podman-container-runlabel.1.html) to set up the container. This allows a container image to embed the command necessary to get the container set up and running.

### Simple Instructions

```bash
podman container runlabel run_whs ghcr.io/patch-upgrade/whs:latest
```

This command will create a container called `whs` and a volume called `whs`, such that data stored in the mitigation lab is not lost when the container is deleted or updated to a new version.

When you run this command, the `whs` container will provide a web front end listening on port `8080`, allowing you to start and stop VMs and attach to their consoles.

You can also use the following command to attach to the console of the container:

```bash
podman attach whs
```

This container runs a [tmux](https://github.com/tmux/tmux/wiki) session. In the first tmux window is a [Carthage](https://github.com/Hadron/carthage) console, which is a modified Python environment that can be used to perform infrastructure-as-code operations on the environment.

When attaching, detach cleanly instead of sending `Ctrl+C` to the session. Because `podman attach` connects to the container's main process, interrupting that session will stop the running service.

You can open additional tmux windows to interact with the environment, including networking, virtual machines, and containers. Containers are run in an interior Podman environment running entirely within the WHS mitigation container itself. Virtual machines are run using libvirt, so normal commands such as [`virsh`](https://libvirt.org/manpages/virsh.html) will work.

### WHS Container Requirements

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
