// A stored zip (.kpack), written a file at a time (art and sound packs: their pictures and sounds are squeezed
// already, and a stored entry is read in place, by range).
import { closeSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { crc32 } from "node:zlib";

// A stored zip, written as it goes: add(name, bytes | file), then end().
export function zipWriter(file) {
  const fd = openSync(`${file}.part`, "w");
  let offset = 0;
  const central = [];
  const put = (buffer) => {
    writeSync(fd, buffer);
    offset += buffer.length;
  };
  return {
    add(name, source) {
      const data = Buffer.isBuffer(source) ? source : readFileSync(source);
      const nameBytes = Buffer.from(name, "utf8");
      const crc = crc32(data) >>> 0;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6); // names in UTF-8
      local.writeUInt16LE(0, 8); // stored
      local.writeUInt16LE(0, 10);
      local.writeUInt16LE(0x21, 12); // 1980-01-01
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      local.writeUInt16LE(0, 28);
      const at = offset;
      put(local);
      put(nameBytes);
      put(data);
      central.push({ nameBytes, crc, size: data.length, at });
    },
    end() {
      const start = offset;
      for (const entry of central) {
        const head = Buffer.alloc(46);
        head.writeUInt32LE(0x02014b50, 0);
        head.writeUInt16LE(20, 4);
        head.writeUInt16LE(20, 6);
        head.writeUInt16LE(0x0800, 8);
        head.writeUInt16LE(0, 10);
        head.writeUInt16LE(0, 12);
        head.writeUInt16LE(0x21, 14);
        head.writeUInt32LE(entry.crc, 16);
        head.writeUInt32LE(entry.size, 20);
        head.writeUInt32LE(entry.size, 24);
        head.writeUInt16LE(entry.nameBytes.length, 28);
        head.writeUInt32LE(entry.at, 42);
        put(head);
        put(entry.nameBytes);
      }
      const tail = Buffer.alloc(22);
      tail.writeUInt32LE(0x06054b50, 0);
      tail.writeUInt16LE(central.length, 8);
      tail.writeUInt16LE(central.length, 10);
      tail.writeUInt32LE(offset - start, 12);
      tail.writeUInt32LE(start, 16);
      put(tail);
      closeSync(fd);
      renameSync(`${file}.part`, file);
      return { files: central.length, bytes: offset };
    },
  };
}
