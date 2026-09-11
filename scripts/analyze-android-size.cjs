#!/usr/bin/env node
/* Inspect APK/AAB ZIP metadata using Node core only; no extraction or third-party tools. */
const fs = require("node:fs");
const path = require("node:path");

const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

function findEocd(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("Not a supported ZIP archive: end-of-central-directory record not found");
}

function parseZip64Size(extra, wantedIndex) {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const id = extra.readUInt16LE(offset);
    const size = extra.readUInt16LE(offset + 2);
    const payload = extra.subarray(offset + 4, offset + 4 + size);
    if (id === 0x0001 && payload.length >= (wantedIndex + 1) * 8) {
      return Number(payload.readBigUInt64LE(wantedIndex * 8));
    }
    offset += 4 + size;
  }
  throw new Error("Unsupported ZIP64 entry");
}

function parseCentralDirectory(buffer) {
  const eocd = findEocd(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`Invalid central-directory entry at byte ${offset}`);
    }
    const compressed32 = buffer.readUInt32LE(offset + 20);
    const uncompressed32 = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const extra = buffer.subarray(nameStart + nameLength, nameStart + nameLength + extraLength);
    let zip64Index = 0;
    const uncompressedBytes =
      uncompressed32 === 0xffffffff ? parseZip64Size(extra, zip64Index++) : uncompressed32;
    const compressedBytes =
      compressed32 === 0xffffffff ? parseZip64Size(extra, zip64Index) : compressed32;
    entries.push({ name, compressedBytes, uncompressedBytes });
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

function categoryFor(name) {
  const normalized = name.replaceAll("\\", "/");
  if (/(?:^|\/)lib\/[^/]+\/[^/]+\.so$/.test(normalized)) return "native libraries";
  if (/\.(?:hbc|bundle)$/.test(normalized) || /index\.android\.bundle$/.test(normalized)) {
    return "JS/Hermes bundle";
  }
  if (/(?:^|\/)assets\//.test(normalized)) return "assets";
  if (/(?:^|\/)res\//.test(normalized) || /(?:^|\/)resources\.pb$/.test(normalized)) {
    return "resources";
  }
  if (/(?:^|\/)(?:dex\/classes\d*\.dex|classes\d*\.dex)$/.test(normalized)) return "DEX";
  return "other";
}

function summarize(entries) {
  const categories = new Map();
  const abis = new Map();
  for (const entry of entries) {
    const category = categoryFor(entry.name);
    const aggregate = categories.get(category) ?? {
      category,
      files: 0,
      compressedBytes: 0,
      uncompressedBytes: 0,
    };
    aggregate.files += 1;
    aggregate.compressedBytes += entry.compressedBytes;
    aggregate.uncompressedBytes += entry.uncompressedBytes;
    categories.set(category, aggregate);

    const abi = entry.name.replaceAll("\\", "/").match(/(?:^|\/)lib\/([^/]+)\/[^/]+\.so$/)?.[1];
    if (abi) {
      const abiAggregate = abis.get(abi) ?? {
        abi,
        files: 0,
        compressedBytes: 0,
        uncompressedBytes: 0,
      };
      abiAggregate.files += 1;
      abiAggregate.compressedBytes += entry.compressedBytes;
      abiAggregate.uncompressedBytes += entry.uncompressedBytes;
      abis.set(abi, abiAggregate);
    }
  }
  return {
    categories: [...categories.values()].sort((a, b) => b.compressedBytes - a.compressedBytes),
    abis: [...abis.values()].sort((a, b) => b.compressedBytes - a.compressedBytes),
    largest: [...entries].sort((a, b) => b.compressedBytes - a.compressedBytes).slice(0, 30),
    nativeLibraries: entries
      .filter((entry) => categoryFor(entry.name) === "native libraries")
      .sort((a, b) => b.compressedBytes - a.compressedBytes),
  };
}

function mib(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function printRows(title, rows, nameKey) {
  process.stdout.write(`\n${title}\n`);
  process.stdout.write(
    `${"Name".padEnd(64)} ${"Files".padStart(7)} ${"ZIP MiB".padStart(10)} ${"Raw MiB".padStart(10)}\n`,
  );
  for (const row of rows) {
    process.stdout.write(
      `${String(row[nameKey]).slice(0, 64).padEnd(64)} ${String(row.files ?? 1).padStart(7)} ${mib(row.compressedBytes).padStart(10)} ${mib(row.uncompressedBytes).padStart(10)}\n`,
    );
  }
}

function main(argv) {
  const input = argv[2];
  if (!input) {
    process.stderr.write("Usage: npm run analyze:android-size -- path/to/app.aab\n");
    return 1;
  }
  const resolved = path.resolve(input);
  const bytes = fs.readFileSync(resolved);
  const entries = parseCentralDirectory(bytes);
  const report = summarize(entries);
  process.stdout.write(`Android artifact: ${resolved}\n`);
  process.stdout.write(`Artifact size: ${bytes.length} bytes (${mib(bytes.length)} MiB)\n`);
  process.stdout.write(`ZIP entries: ${entries.length}\n`);
  printRows("Category totals", report.categories, "category");
  printRows("ABI native-library contribution", report.abis, "abi");
  printRows("Largest 30 entries", report.largest, "name");
  printRows("Largest native libraries", report.nativeLibraries.slice(0, 30), "name");
  process.stdout.write(
    "\nDevice-specific Play download and installed size require bundletool/Play Console measurement; this script does not estimate them.\n",
  );
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv);

module.exports = { categoryFor, parseCentralDirectory, summarize };
