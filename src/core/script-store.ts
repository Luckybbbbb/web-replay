import { promises as fs } from 'fs';
import { mkdirSync } from 'fs';
import path from 'path';
import type { RecordingScript } from '../types/index.js';

/**
 * Sanitize a recording name to prevent path traversal attacks.
 * Removes any character that is not alphanumeric, hyphen, or underscore.
 */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Returns the recordings directory path, creating it if it does not exist.
 */
export function getRecordingsDir(baseDir: string): string {
  const dir = path.join(baseDir, 'recordings');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * List all recordings in the recordings directory.
 * Reads every `.json` file, parses it, and returns the array.
 */
export async function listRecordings(
  baseDir: string,
): Promise<RecordingScript[]> {
  const dir = getRecordingsDir(baseDir);
  const files = await fs.readdir(dir);
  const jsonFiles = files.filter((f: string) => f.endsWith('.json'));

  const recordings: RecordingScript[] = [];

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf-8');
      const parsed: RecordingScript = JSON.parse(raw);
      recordings.push(parsed);
    } catch {
      // Skip malformed files silently
    }
  }

  return recordings;
}

/**
 * Get a single recording by name.
 * Returns `null` if the recording does not exist or cannot be parsed.
 */
export async function getRecording(
  baseDir: string,
  name: string,
): Promise<RecordingScript | null> {
  const safe = sanitizeName(name);
  if (!safe) return null;

  const filePath = path.join(getRecordingsDir(baseDir), `${safe}.json`);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as RecordingScript;
  } catch {
    return null;
  }
}

/**
 * Save a recording script to `recordings/{name}.json`.
 * The file name is derived from `script.name` after sanitization.
 */
export async function saveRecording(
  baseDir: string,
  script: RecordingScript,
): Promise<void> {
  const safe = sanitizeName(script.name);
  const dir = getRecordingsDir(baseDir);
  const filePath = path.join(dir, `${safe}.json`);
  const json = JSON.stringify(script, null, 2);
  await fs.writeFile(filePath, json, 'utf-8');
}

/**
 * Delete a recording file by name.
 * Returns `true` if the file was deleted, `false` if it did not exist.
 */
export async function deleteRecording(
  baseDir: string,
  name: string,
): Promise<boolean> {
  const safe = sanitizeName(name);
  if (!safe) return false;

  const filePath = path.join(getRecordingsDir(baseDir), `${safe}.json`);

  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a recording with the given name exists.
 */
export async function recordingExists(
  baseDir: string,
  name: string,
): Promise<boolean> {
  const safe = sanitizeName(name);
  if (!safe) return false;

  const filePath = path.join(getRecordingsDir(baseDir), `${safe}.json`);

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
