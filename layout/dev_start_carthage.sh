#!/bin/sh
# Development variant of the base image's /start-carthage.sh.
#
# The base image hard-codes PYTHONPATH=/carthage. When whs starts in
# --develop mode it overmounts THIS script onto /start-carthage.sh so the
# vendor dev checkouts (mounted under /opt/vendor/<name>) are importable.
# Here we start from the carthage root and APPEND any /opt/vendor/* entries
# that actually exist, rather than clobbering an inherited PYTHONPATH.
PYTHONPATH=/carthage
if [ -d /opt/vendor ]; then
    for d in /opt/vendor/*; do
        [ -d "$d" ] && PYTHONPATH="$PYTHONPATH:$d"
    done
fi
export PYTHONPATH
cd /carthage
runner_config=
test -f /layout/carthage_plugin.yml && runner_config="--plugin /layout"
test -f /layout/config.yml && runner_config="--config /layout/config.yml $runner_config"
if [ "${runner_config}x" != "x" ]; then
    apt update
    /carthage/bin/carthage $runner_config install_dependencies
    exec /carthage/bin/carthage-runner $runner_config --generate --keep --tmux
   fi
exec ./bin/carthage-console
