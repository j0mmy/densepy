# Runtime capability sandbox for `gpy run --safe`. Installed as a non-removable
# audit hook (PEP 578) before user code runs; blocks process spawning, network
# access, and file writes. This is defense-in-depth for machine-written code,
# not a security boundary against a determined adversary.
import runpy
import sys

_BLOCKED = {
    "subprocess.Popen", "os.system", "os.exec", "os.spawn", "os.spawnl",
    "os.spawnv", "os.fork", "socket.connect", "socket.bind",
    "socket.getaddrinfo", "ctypes.dlopen",
}


def _hook(event, args):
    if event in _BLOCKED:
        raise PermissionError(f"safe mode blocked capability: {event}")
    if event == "open":
        mode = args[1] if len(args) > 1 else None
        if mode and any(m in mode for m in ("w", "a", "x", "+")):
            raise PermissionError(f"safe mode blocked file write: {args[0]}")


def run(path, argv):
    sys.argv = [path, *argv]
    sys.addaudithook(_hook)
    runpy.run_path(path, run_name="__main__")
