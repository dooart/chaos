#!/usr/bin/env bun

import { newNote, updateNote, renameNote, deleteNote, searchNotes } from "./lib/notes.ts";
import { addImageToNote } from "./lib/images.ts";
import { validatePrd } from "./lib/prd.ts";
import { parseNote } from "./lib/frontmatter.ts";
import { readFileSync } from "fs";

const [command, ...args] = process.argv.slice(2);

function usage() {
  console.error(`Usage: chaos.ts <command> [args]

Commands:
  new <title>                          Create a new note
  update <id> [options] <content>       Update a note
    --status=building|done|clear
    --tags=tag1,tag2 (empty to clear)
  rename <id> <new-title>              Rename a note
  delete <id>                          Delete a note
  search <query>                       Search notes (returns JSON)
  add-image <id> <path> <description>  Add image to note
  validate-prd <path>                  Validate a prd.json file
  parse <file> [field|--json]           Parse note frontmatter`);
  process.exit(1);
}

if (!command) usage();

try {
  switch (command) {
    case "new": {
      if (!args[0]) { console.error("Usage: chaos.ts new <title>"); process.exit(1); }
      const path = newNote(args[0]);
      console.log(path);
      break;
    }

    case "update": {
      let id = "";
      let content: string | undefined;
      let status: string | undefined;
      let tags: string[] | null | undefined;

      for (const arg of args) {
        if (arg.startsWith("--status=")) {
          status = arg.slice(9);
        } else if (arg.startsWith("--tags=")) {
          const val = arg.slice(7);
          tags = val ? val.split(",") : null;
        } else if (!id) {
          id = arg;
        } else {
          content = arg;
        }
      }
      if (!id) { console.error("Usage: chaos.ts update <id> [options] <content>"); process.exit(1); }

      const path = updateNote(id, {
        status: status === undefined ? undefined : (status || null),
        tags,
        content,
      });
      console.log(`updated ${path}`);
      break;
    }

    case "rename": {
      if (!args[0] || !args[1]) { console.error("Usage: chaos.ts rename <id> <new-title>"); process.exit(1); }
      const path = renameNote(args[0], args[1]);
      console.log(path);
      break;
    }

    case "delete": {
      if (!args[0]) { console.error("Usage: chaos.ts delete <id>"); process.exit(1); }
      const path = deleteNote(args[0]);
      console.log(`deleted ${path}`);
      break;
    }

    case "search": {
      if (!args[0]) { console.error("Usage: chaos.ts search <query>"); process.exit(1); }
      const results = searchNotes(args[0]);
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    case "add-image": {
      if (!args[0] || !args[1] || !args[2]) {
        console.error("Usage: chaos.ts add-image <id> <path> <description>");
        process.exit(1);
      }
      const result = await addImageToNote(args[0], args[1], args[2]);
      console.log(result);
      break;
    }

    case "validate-prd": {
      if (!args[0]) { console.error("Usage: chaos.ts validate-prd <path>"); process.exit(1); }
      const raw = JSON.parse(readFileSync(args[0], "utf-8"));
      const result = validatePrd(raw);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
      break;
    }

    case "parse": {
      if (!args[0]) { console.error("Usage: chaos.ts parse <file> [field|--json]"); process.exit(1); }
      const note = parseNote(args[0]);
      const field = args[1];

      if (field === "--json") {
        console.log(JSON.stringify({ ...note.data, body: note.body }));
      } else if (field === "body") {
        console.log(note.body);
      } else if (field) {
        const value = note.data[field];
        if (value === undefined) process.exit(0);
        if (Array.isArray(value)) {
          console.log(`[${value.join(", ")}]`);
        } else {
          console.log(value);
        }
      } else {
        for (const [key, val] of Object.entries(note.data)) {
          if (Array.isArray(val)) {
            console.log(`${key}: [${val.join(", ")}]`);
          } else {
            console.log(`${key}: ${val}`);
          }
        }
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      usage();
  }
} catch (e: any) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
