/* FLASH6 ZIP readers. Loaded before flash6.js. */
(function(global){
  "use strict";

  const EOCD_SIG = 0x06054b50;
  const ZIP64_LOCATOR_SIG = 0x07064b50;
  const ZIP64_EOCD_SIG = 0x06064b50;
  const CD_SIG = 0x02014b50;
  const LOCAL_SIG = 0x04034b50;

  function normalizePath(path){
    const parts = [];
    String(path || "").replace(/\\/g, "/").split("/").forEach((part)=>{
      if(!part || part === ".") return;
      if(part === ".."){
        if(parts.length) parts.pop();
        return;
      }
      parts.push(part);
    });
    return parts.join("/");
  }

  function resolvePath(baseDir, target){
    if(!target) return "";
    if(String(target)[0] === "/") return normalizePath(String(target).slice(1));
    return normalizePath((baseDir ? (baseDir + "/") : "") + target);
  }

  function readUint64(view, offset){
    if(typeof view.getBigUint64 === "function"){
      return Number(view.getBigUint64(offset, true));
    }
    const lo = view.getUint32(offset, true);
    const hi = view.getUint32(offset + 4, true);
    return (hi * 4294967296) + lo;
  }

  function readZip64Extra(view, offset, length, needs){
    const out = {};
    let p = offset;
    const end = offset + length;
    while(p + 4 <= end){
      const headerId = view.getUint16(p, true);
      const size = view.getUint16(p + 2, true);
      const dataStart = p + 4;
      if(headerId === 0x0001){
        let q = dataStart;
        if(needs.uncompressedSize && q + 8 <= dataStart + size){
          out.uncompressedSize = readUint64(view, q);
          q += 8;
        }
        if(needs.compressedSize && q + 8 <= dataStart + size){
          out.compressedSize = readUint64(view, q);
          q += 8;
        }
        if(needs.localOffset && q + 8 <= dataStart + size){
          out.localOffset = readUint64(view, q);
        }
        return out;
      }
      p += 4 + size;
    }
    return out;
  }

  async function inflateDeflateRaw(dataBytes, unsupportedMessage){
    if(typeof DecompressionStream === "undefined"){
      throw new Error(unsupportedMessage || "ZIP deflate decompression is not supported in this browser");
    }
    const stream = new Blob([dataBytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const arrayBuffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async function decodeEntryBytes(bytes, method, nameForError){
    if(method === 0) return bytes;
    if(method === 8){
      return await inflateDeflateRaw(bytes, "브라우저에서 ZIP 압축 해제를 지원하지 않습니다. (DecompressionStream 없음)");
    }
    throw new Error("지원하지 않는 ZIP 압축 방식(" + method + "): " + (nameForError || "-"));
  }

  async function decodeEntryText(bytes, method, nameForError){
    const decoded = await decodeEntryBytes(bytes, method, nameForError);
    return new TextDecoder("utf-8").decode(decoded);
  }

  function findEocd(view){
    const searchStart = Math.max(0, view.byteLength - 65557);
    for(let i = view.byteLength - 22; i >= searchStart; i--){
      if(view.getUint32(i, true) === EOCD_SIG) return i;
    }
    return -1;
  }

  function readCentralDirectoryInfo(view){
    const eocd = findEocd(view);
    if(eocd < 0) throw new Error("ZIP directory not found");

    let centralSize = view.getUint32(eocd + 12, true);
    let centralOffset = view.getUint32(eocd + 16, true);
    let totalEntries = view.getUint16(eocd + 10, true);

    if(centralOffset === 0xffffffff || centralSize === 0xffffffff || totalEntries === 0xffff){
      const locator = eocd - 20;
      if(locator < 0 || view.getUint32(locator, true) !== ZIP64_LOCATOR_SIG){
        throw new Error("ZIP64 locator not found");
      }
      const zip64EocdOffset = readUint64(view, locator + 8);
      if(view.getUint32(zip64EocdOffset, true) !== ZIP64_EOCD_SIG){
        throw new Error("ZIP64 directory not found");
      }
      totalEntries = readUint64(view, zip64EocdOffset + 32);
      centralSize = readUint64(view, zip64EocdOffset + 40);
      centralOffset = readUint64(view, zip64EocdOffset + 48);
    }

    if(centralOffset < 0 || centralOffset > view.byteLength){
      throw new Error("ZIP central directory offset is invalid");
    }
    if(centralOffset + centralSize > view.byteLength){
      throw new Error("ZIP central directory is corrupt");
    }
    return {centralOffset, centralSize, totalEntries};
  }

  function readCentralEntry(view, bytes, offset, decoder){
    if(view.getUint32(offset, true) !== CD_SIG) return null;
    const method = view.getUint16(offset + 10, true);
    const compressedSize32 = view.getUint32(offset + 20, true);
    const uncompressedSize32 = view.getUint32(offset + 24, true);
    const fileNameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset32 = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLen));
    const extraOffset = offset + 46 + fileNameLen;
    const zip64 = (compressedSize32 === 0xffffffff || uncompressedSize32 === 0xffffffff || localOffset32 === 0xffffffff)
      ? readZip64Extra(view, extraOffset, extraLen, {
          uncompressedSize: uncompressedSize32 === 0xffffffff,
          compressedSize: compressedSize32 === 0xffffffff,
          localOffset: localOffset32 === 0xffffffff
        })
      : {};
    return {
      name,
      normalizedName: normalizePath(name).toLowerCase(),
      method,
      compressedSize: zip64.compressedSize || compressedSize32,
      localOffset: zip64.localOffset || localOffset32,
      nextOffset: offset + 46 + fileNameLen + extraLen + commentLen
    };
  }

  function getEntryCompressedBytes(view, bytes, entry){
    const localOffset = entry.localOffset;
    if(view.getUint32(localOffset, true) !== LOCAL_SIG){
      throw new Error("ZIP local header is corrupt: " + entry.name);
    }
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + entry.compressedSize;
    if(dataEnd > bytes.length){
      throw new Error("ZIP entry is out of range: " + entry.name);
    }
    return bytes.subarray(dataStart, dataEnd);
  }

  async function readTextEntry(arrayBuffer, wantedNames){
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const names = new Set((wantedNames || []).map((value)=>normalizePath(value).toLowerCase()));
    const info = readCentralDirectoryInfo(view);
    const decoder = new TextDecoder("utf-8");
    let offset = info.centralOffset;
    for(let i = 0; i < info.totalEntries; i++){
      const entry = readCentralEntry(view, bytes, offset, decoder);
      if(!entry) break;
      if(names.has(entry.normalizedName)){
        const compressed = getEntryCompressedBytes(view, bytes, entry);
        return await decodeEntryText(compressed, entry.method, entry.name);
      }
      offset = entry.nextOffset;
    }
    throw new Error("ZIP text entry not found");
  }

  async function readEntries(arrayBuffer){
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const info = readCentralDirectoryInfo(view);
    const decoder = new TextDecoder("utf-8");
    const entries = new Map();
    let offset = info.centralOffset;
    for(let i = 0; i < info.totalEntries; i++){
      const entry = readCentralEntry(view, bytes, offset, decoder);
      if(!entry) break;
      const compressed = getEntryCompressedBytes(view, bytes, entry);
      const decoded = await decodeEntryBytes(compressed, entry.method, entry.name);
      entries.set(normalizePath(entry.name), decoded);
      offset = entry.nextOffset;
    }
    return entries;
  }

  function textFromEntries(entries, path){
    const key = normalizePath(path);
    const bytes = entries && entries.get ? entries.get(key) : null;
    if(!bytes) return null;
    return new TextDecoder("utf-8").decode(bytes);
  }

  global.FLASH6_ZIP = Object.freeze({
    normalizePath,
    resolvePath,
    readTextEntry,
    readEntries,
    textFromEntries
  });
})(typeof window !== "undefined" ? window : globalThis);
