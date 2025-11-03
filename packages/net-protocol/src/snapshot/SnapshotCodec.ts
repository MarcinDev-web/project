import type { SnapshotMessage } from '../index.js';
import { BitWriter } from '../bitstream/BitWriter.js';
import { writeVarUint, readVarUint } from '../bitstream/VarInt.js';

export function encodeSnapshot(msg: SnapshotMessage): Uint8Array {
  const header: number[] = [];
  writeVarUint(msg.header.seq, header);
  writeVarUint(msg.header.ackInputSeq, header);
  writeVarUint(msg.header.baselineSeq ?? 0, header);
  writeVarUint(msg.payload.byteLength, header);

  const writer = new BitWriter();
  for (let i = 0; i < header.length; i++) {
    const byte = header[i];
    if (byte !== undefined) {
      writer.writeByte(byte);
    }
  }
  writer.writeBytes(msg.payload);
  return writer.toUint8Array();
}

export function decodeSnapshot(bytes: Uint8Array): SnapshotMessage {
  let off = 0;
  let r = readVarUint(bytes, off);
  const seq = r.value;
  off = r.next;
  r = readVarUint(bytes, off);
  const ackInputSeq = r.value;
  off = r.next;
  r = readVarUint(bytes, off);
  const baselineSeq = r.value;
  off = r.next;
  r = readVarUint(bytes, off);
  const payloadLen = r.value;
  off = r.next;
  const payload = bytes.slice(off, off + payloadLen);
  return {
    header: { seq, ackInputSeq, baselineSeq, byteLength: payloadLen },
    payload,
  };
}
