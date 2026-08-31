from __future__ import annotations

import argparse
import os
from pathlib import Path

import pytest

from patch_whs.cli import (
    CONTAINER_CARTHAGE_DIR,
    CONTAINER_START_SCRIPT,
    CONTAINER_VENDOR_DIR,
    build_runtime_options,
    discover_develop_vendor_mounts,
)


def make_symlink(link: Path, target: Path) -> None:
    link.symlink_to(target)


@pytest.fixture
def vendor_tree(tmp_path: Path):
    """Lay out ./vendor with the shapes discover_develop_vendor_mounts handles."""
    vendor = tmp_path / "vendor"
    vendor.mkdir()

    # The dev start script the CLI overmounts (lives in the repo's layout/).
    (tmp_path / "layout").mkdir()
    (tmp_path / "layout" / "dev_start_carthage.sh").write_text("#!/bin/sh\n")

    # A real carthage checkout that vendor/carthage will point at.
    carthage_home = tmp_path / "carthage"
    (carthage_home / "carthage").mkdir(parents=True)
    (carthage_home / "carthage" / "__init__.py").write_text("")

    # A real entanglement checkout that vendor/entanglement will point at.
    entanglement_home = tmp_path / "entanglement"
    (entanglement_home / "entanglement").mkdir(parents=True)
    (entanglement_home / "entanglement" / "__init__.py").write_text("")

    # vendor/carthage -> ~/carthage
    make_symlink(vendor / "carthage", carthage_home)
    # vendor/entanglement -> ~/entanglement
    make_symlink(vendor / "entanglement", entanglement_home)
    # a plain directory is mounted directly
    (vendor / "plain").mkdir()
    # a dangling symlink is ignored (with a warning)
    make_symlink(vendor / "dangling", tmp_path / "does-not-exist")
    # a symlink to a file is ignored
    (tmp_path / "afile.txt").write_text("x")
    make_symlink(vendor / "filelink", tmp_path / "afile.txt")

    return vendor


def test_discover_mounts_resolves_symlinks_and_maps_carthage(vendor_tree: Path):
    mounts = discover_develop_vendor_mounts(vendor_tree)
    carthage = str((vendor_tree / "carthage").resolve())
    entanglement = str((vendor_tree / "entanglement").resolve())
    plain = str(vendor_tree / "plain")
    expected = [
        (carthage, CONTAINER_CARTHAGE_DIR),
        (entanglement, f"{CONTAINER_VENDOR_DIR}/entanglement"),
        (plain, f"{CONTAINER_VENDOR_DIR}/plain"),
    ]
    assert mounts == expected


def test_discover_mounts_missing_vendor_dir():
    assert discover_develop_vendor_mounts(Path("/nonexistent/vendor")) == []


def test_develop_mode_emits_readonly_bind_mounts(monkeypatch, tmp_path: Path, vendor_tree: Path):
    monkeypatch.chdir(vendor_tree.parent)  # so ./vendor resolves to the fixture
    args = argparse.Namespace(develop=True, expose_libvirt=None, nic=None)
    options = build_runtime_options(args)
    carthage = str((vendor_tree / "carthage").resolve())
    entanglement = str((vendor_tree / "entanglement").resolve())
    assert "-v" in options
    assert f"{carthage}:{CONTAINER_CARTHAGE_DIR}:ro" in options
    assert f"{entanglement}:{CONTAINER_VENDOR_DIR}/entanglement:ro" in options
    pythonpath = os.pathsep.join([
        CONTAINER_CARTHAGE_DIR,
        f"{CONTAINER_VENDOR_DIR}/entanglement",
        f"{CONTAINER_VENDOR_DIR}/plain",
    ])
    assert "-e" in options
    assert f"PYTHONPATH={pythonpath}" in options
    # The dev start script is overmounted onto the base image's start script.
    assert f"{tmp_path / 'layout' / 'dev_start_carthage.sh'}:{CONTAINER_START_SCRIPT}:ro" in options


def test_non_develop_mode_emits_no_vendor_mounts(monkeypatch, vendor_tree: Path):
    monkeypatch.chdir(vendor_tree.parent)
    args = argparse.Namespace(develop=False, expose_libvirt=None, nic=None)
    assert build_runtime_options(args) == []
