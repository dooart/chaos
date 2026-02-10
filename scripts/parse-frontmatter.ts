#!/usr/bin/env bun
import matter from "gray-matter";
import { readFileSync } from "fs";

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error("Usage: parse-frontmatter.ts <file> [field|--json]");
  console.error("  field: id, title, status, tags, body");
  console.error("  --json: output all frontmatter as JSON");
  process.exit(1);
}

const file = args[0];
const field = args[1];

try {
  const content = readFileSync(file, "utf-8");
  const { data, content: body } = matter(content);

  if (field === "--json") {
    console.log(JSON.stringify({ ...data, body }));
  } else if (field === "body") {
    console.log(body.trim());
  } else if (field) {
    const value = data[field];
    if (value === undefined) {
      // Output nothing for missing fields
      process.exit(0);
    }
    if (Array.isArray(value)) {
      // Output as YAML-style array for tags
      console.log(`[${value.join(", ")}]`);
    } else {
      console.log(value);
    }
  } else {
    // No field specified, output all frontmatter as key: value
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        console.log(`${key}: [${val.join(", ")}]`);
      } else {
        console.log(`${key}: ${val}`);
      }
    }
  }
} catch (e: any) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
