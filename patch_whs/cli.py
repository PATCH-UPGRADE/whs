from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from typing import Mapping

DEFAULT_IMAGE = "ghcr.io/patch-upgrade/whs:latest"
RUN_LABEL = "run_whs"
DEVELOP_LABEL = "develop_whs"
PODMAN_REMOTE_STRIP_ARGS = {"--group-add=keep-groups"}
PODMAN_REMOTE_PLATFORMS = {"darwin", "win32"}
VARIABLE_PATTERN = re.compile(r"\$(\w+)|\$\{([^}]+)\}")


class WhsError(RuntimeError):
    """Raised for recoverable CLI errors."""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="whs")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start_parser = subparsers.add_parser("start", help="Pull and start a WHS container")
    start_parser.add_argument("--name", default="whs", help="Container and volume name")
    start_parser.add_argument(
        "--image",
        default=DEFAULT_IMAGE,
        help="Container image to start",
    )
    start_parser.add_argument(
        "--develop",
        action="store_true",
        help="Use the develop_whs image label instead of run_whs",
    )
    start_parser.add_argument(
        "--expose-libvirt",
        metavar="DIR",
        help="Bind mount DIR to /run/libvirt inside the container",
    )
    start_parser.add_argument(
        "--nic",
        metavar="IFNAME",
        action="append",
        help="Attach real device(s) via macvlan on specified interface(s)",
    )
    start_parser.set_defaults(handler=handle_start)
    return parser


def inspect_image_labels(image: str) -> dict[str, str]:
    """Inspect a podman image and return its labels."""
    result = run_podman_command(["podman", "image", "inspect", image], capture_output=True)
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise WhsError(f"podman inspect returned invalid JSON for image {image!r}") from exc

    if not isinstance(payload, list) or not payload:
        raise WhsError(f"podman inspect returned no data for image {image!r}")

    image_info = payload[0]
    if not isinstance(image_info, dict):
        raise WhsError(f"podman inspect returned an unexpected payload for image {image!r}")

    config = image_info.get("Config")
    if not isinstance(config, dict):
        raise WhsError(f"image {image!r} is missing Config metadata")

    labels = config.get("Labels")
    if labels is None:
        return {}
    if not isinstance(labels, dict):
        raise WhsError(f"image {image!r} returned non-dictionary labels")
    return {str(key): str(value) for key, value in labels.items()}


def expand_run_label(command: str, variables: Mapping[str, str]) -> str:
    """Expand shell-style $NAME and ${NAME} placeholders."""

    def replace(match: re.Match[str]) -> str:
        key = match.group(1) or match.group(2)
        return variables.get(key, os.environ.get(key, match.group(0)))

    return VARIABLE_PATTERN.sub(replace, command)


def parse_command(command: str) -> list[str]:
    """Split a run label into argv using shell-compatible rules."""
    return shlex.split(command, posix=True)


def ensure_macvlan_network(nic: str) -> None:
    """Ensure the macvlan network for the given NIC exists."""
    net_name = f"whs-{nic}"
    run_podman_command([
        "podman", "network", "create", 
        "--driver", "macvlan", 
        "-o", f"parent={nic}", 
        "-o", "mode=passthru", 
        "--ipam-driver", "none", 
        "--ignore", 
        net_name
    ])


def build_runtime_options(args: argparse.Namespace) -> list[str]:
    options: list[str] = []
    if args.expose_libvirt:
        libvirt_dir = Path(args.expose_libvirt)
        options.extend(["-v", f"{libvirt_dir}:/run/libvirt"])

    nics = args.nic or []
    if nics:
        # Add default network first
        options.extend(["--network", get_default_network()])
        for nic in nics:
            ensure_macvlan_network(nic)
            options.extend(["--network", f"whs-{nic}:interface_name=xi-{nic}"])
    return options


def shell_join(argv: list[str]) -> str:
    return " ".join(shlex.quote(arg) for arg in argv)


def strip_podman_remote_command_args(argv: list[str]) -> list[str]:
    if sys.platform not in PODMAN_REMOTE_PLATFORMS:
        return argv
    return [arg for arg in argv if arg not in PODMAN_REMOTE_STRIP_ARGS]


def ensure_windows_nested_virtualization() -> None:
    if sys.platform != "win32":
        return

    wslconfig_path = Path.home() / ".wslconfig"
    if wslconfig_path.exists():
        content = wslconfig_path.read_text(encoding="utf-8")
    else:
        content = ""

    lines = content.splitlines()
    if not lines:
        print(f"whs: adding nestedVirtualization=true to {wslconfig_path}", file=sys.stderr)
        wslconfig_path.write_text("[wsl2]\nnestedVirtualization=true\n", encoding="utf-8")
        return

    in_wsl2 = False
    saw_wsl2 = False
    insert_at = len(lines)

    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            if in_wsl2:
                insert_at = index
                break
            in_wsl2 = stripped.casefold() == "[wsl2]"
            saw_wsl2 = saw_wsl2 or in_wsl2
            continue

        if not in_wsl2 or not stripped or stripped.startswith(("#", ";")):
            continue

        key = stripped.split("=", 1)[0].strip()
        if key.casefold() == "nestedvirtualization":
            return

    if saw_wsl2:
        lines.insert(insert_at, "nestedVirtualization=true")
    else:
        if lines[-1].strip():
            lines.append("")
        lines.extend(["[wsl2]", "nestedVirtualization=true"])

    print(f"whs: adding nestedVirtualization=true to {wslconfig_path}", file=sys.stderr)
    wslconfig_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_podman_command(argv: list[str], capture_output: bool = False) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            argv,
            check=True,
            text=True,
            capture_output=capture_output,
        )
    except FileNotFoundError as exc:
        raise WhsError(
            "podman was not found. Install Podman and ensure it is on PATH before using whs."
        ) from exc
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else ""
        suffix = f": {stderr}" if stderr else ""
        raise WhsError(f"command failed: {' '.join(argv)}{suffix}") from exc


def ensure_podman_ready() -> None:
    '''
    Ensure that Podman is installed & the default machine is rootful on MacOS/Windows
    '''
    if sys.platform in PODMAN_REMOTE_PLATFORMS:
        result = run_podman_command(['podman', 'machine', 'inspect'],
                                    capture_output=True)
        machine_info = json.loads(result.stdout)
        if machine_info and not machine_info[0].get("Rootful"):
            raise WhsError(
                "A rootful podman machine is required to run WHS. \n"
                "Run 'podman machine set --rootful'")
    return


def get_default_network() -> str:
    """Return the default podman network name."""
    result = run_podman_command(["podman", "info", "--format", "json"], capture_output=True)
    try:
        data = json.loads(result.stdout)
        return data["host"]["networkBackendInfo"]["defaultNetwork"]
    except (json.JSONDecodeError, KeyError):
        return "podman"


def handle_start(args: argparse.Namespace) -> int:
    ensure_podman_ready()
    ensure_windows_nested_virtualization()
    
    if not args.image.startswith("localhost/"):
        run_podman_command(["podman", "pull", args.image])
    labels = inspect_image_labels(args.image)
    label_name = DEVELOP_LABEL if args.develop else RUN_LABEL
    try:
        label_command = labels[label_name]
    except KeyError as exc:
        raise WhsError(f"image {args.image!r} does not define the {label_name!r} label") from exc

    expanded_command = expand_run_label(
        label_command,
        {
            "IMAGE": shell_join([*build_runtime_options(args), args.image]),
            "NAME": args.name,
        },
    )
    
    argv = strip_podman_remote_command_args(parse_command(expanded_command))
    run_podman_command(argv)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    handler = args.handler
    try:
        return handler(args)
    except WhsError as exc:
        parser.exit(status=1, message=f"whs: {exc}\n")


if __name__ == "__main__":
    sys.exit(main())
