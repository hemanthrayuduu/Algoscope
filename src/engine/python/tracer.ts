// The Python driver, embedded as a string so it can be handed to Pyodide.
//
// It runs the user's code under sys.settrace, recording a snapshot of local
// variables before every line executes, and serializes Python values into the
// same tagged shape the JS interpreter emits (see engine/types.ts). Linked-list
// and tree nodes written as normal Python classes (with .val/.next or
// .val/.left/.right) come out as VizObjects and render as node-link diagrams.

export const TRACER_SOURCE = String.raw`
import sys, io, json

USER_FILE = "<algoscope-user>"

def _run(code, entry_function, args_json, max_steps, trace=True):
    steps = []
    stdout_buffer = io.StringIO()

    class _StepLimit(Exception):
        pass

    def serialize(o, depth=0, seen=None):
        if seen is None:
            seen = set()
        if o is None or isinstance(o, bool):
            return o
        if isinstance(o, int):
            return o
        if isinstance(o, float):
            return o if (o == o and o not in (float("inf"), float("-inf"))) else str(o)
        if isinstance(o, str):
            return o
        if depth > 6:
            return "..."
        oid = id(o)
        if oid in seen:
            return "<circular>"
        seen = seen | {oid}
        if isinstance(o, (list, tuple)):
            return [serialize(x, depth + 1, seen) for x in o]
        if isinstance(o, dict):
            return {
                "__kind": "map",
                "entries": [
                    [serialize(k, depth + 1, seen), serialize(v, depth + 1, seen)]
                    for k, v in o.items()
                ],
            }
        if isinstance(o, (set, frozenset)):
            return {"__kind": "set", "items": [serialize(x, depth + 1, seen) for x in o]}
        if callable(o):
            return {"__kind": "function", "name": getattr(o, "__name__", "function")}
        # Treat any other object with attributes as a record/instance node.
        fields = {}
        if hasattr(o, "__dict__"):
            for k, v in vars(o).items():
                if not k.startswith("__"):
                    fields[k] = serialize(v, depth + 1, seen)
        elif hasattr(o, "__slots__"):
            for k in o.__slots__:
                if hasattr(o, k):
                    fields[k] = serialize(getattr(o, k), depth + 1, seen)
        else:
            return str(o)
        return {"__kind": "object", "className": type(o).__name__, "fields": fields}

    def snapshot_vars(frame):
        out = {}
        for name, value in frame.f_locals.items():
            if name.startswith("__"):
                continue
            if callable(value) or type(value).__name__ == "module":
                continue
            out[name] = serialize(value)
        return out

    def build_stack(frame):
        stack = []
        f = frame
        while f is not None and f.f_code.co_filename == USER_FILE:
            name = f.f_code.co_name
            stack.append({"fn": "global" if name == "<module>" else name, "line": f.f_lineno})
            f = f.f_back
        stack.reverse()
        return stack

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != USER_FILE:
            return None
        if event == "line":
            if len(steps) >= max_steps:
                raise _StepLimit()
            steps.append({
                "line": frame.f_lineno,
                "variables": snapshot_vars(frame),
                "callStack": build_stack(frame),
                "stdout": stdout_buffer.getvalue(),
            })
        return tracer

    error = None
    return_value = None
    old_stdout = sys.stdout
    sys.stdout = stdout_buffer
    try:
        namespace = {}
        compiled = compile(code, USER_FILE, "exec")
        args = json.loads(args_json or "[]")
        if not isinstance(args, list):
            raise ValueError("Arguments must be a JSON array")
        # Judging only needs the return value, and tracing every line is by far
        # the dominant cost, so it is skipped unless a trace was requested.
        if trace:
            sys.settrace(tracer)
        exec(compiled, namespace)
        # An empty entry function means "run this as a script": the module body
        # is the program, and its trace is the whole story.
        entry = (entry_function or "").strip()
        if entry:
            if entry not in namespace:
                raise NameError(
                    'Function "%s" was not found. Leave the run function blank to run the code as a script.' % entry
                )
            result = namespace[entry](*args)
            return_value = serialize(result)
    except _StepLimit:
        error = "Stopped after %d steps (possible infinite loop)." % max_steps
    except Exception as exc:  # noqa: BLE001 - surface any user error to the UI
        error = "%s: %s" % (type(exc).__name__, exc)
    finally:
        sys.settrace(None)
        sys.stdout = old_stdout

    return json.dumps({
        "steps": steps,
        "returnValue": return_value,
        "stdout": stdout_buffer.getvalue(),
        "error": error,
    })
`;
