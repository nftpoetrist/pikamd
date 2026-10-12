import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// A JSON file used as a tiny local database for the dev preview (web/.data/, git-ignored).
// Updates run one at a time in this process and land atomically (write a temp file, rename),
// so concurrent requests can't lose each other's writes. Never used in production.
export function jsonFileStore<State>(fileName: string, parse: (raw: unknown) => State) {
  const file = path.join(process.cwd(), ".data", fileName);

  async function load(): Promise<State> {
    try {
      return parse(JSON.parse(await readFile(file, "utf8")));
    } catch {
      return parse(null); // no file yet, or unreadable: start empty
    }
  }

  let queue: Promise<unknown> = Promise.resolve();

  /** Applies `change` to the latest state, saves the new state and returns the change's result. */
  function update<Result>(change: (state: State) => { next: State; result: Result }): Promise<Result> {
    const run = queue.then(async () => {
      const { next, result } = change(await load());
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
      await rename(tmp, file);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  /** Reads wait for queued writes, so a read right after a write sees it. */
  const read = (): Promise<State> => queue.then(load);

  return { read, update };
}
