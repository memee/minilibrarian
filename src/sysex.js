const KORG_ID = 0x42;
const XD_DEVICE_ID = [0x00, 0x01, 0x51];
const REQUEST_PROGRAM = 0x1c;
const DUMP_PROGRAM = 0x4c;
const PROGRAM_BYTES = 1024;

export function buildProgramRequest(slot, channel = 0) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 499) {
    throw new RangeError('Program number must be between 1 and 500.');
  }
  if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
    throw new RangeError('MIDI channel must be between 1 and 16.');
  }
  return [
    0xf0, KORG_ID, 0x30 | channel, ...XD_DEVICE_ID, REQUEST_PROGRAM,
    slot & 0x7f, (slot >> 7) & 0x7f, 0xf7
  ];
}

export function decodeProgramDump(message, channel, slot) {
  const bytes = message instanceof Uint8Array ? message : new Uint8Array(message);
  if (bytes.length < 8 || bytes[0] !== 0xf0 || bytes.at(-1) !== 0xf7) return null;
  if (bytes[1] !== KORG_ID || (bytes[2] & 0xf0) !== 0x30) return null;
  if ((bytes[2] & 0x0f) !== channel || bytes[3] !== XD_DEVICE_ID[0] ||
      bytes[4] !== XD_DEVICE_ID[1] || bytes[5] !== XD_DEVICE_ID[2] ||
      bytes[6] !== DUMP_PROGRAM) return null;

  // The original receiver decodes from offset 7. Some Korg dump layouts also
  // echo the two-byte slot index before the packed record, so try that form
  // as well and only accept a candidate that validates as a PROG file record.
  const payload = bytes.subarray(7, bytes.length - 1);
  if (payload.length < 1171) {
    throw new Error(`Program ${slot + 1} arrived with only ${payload.length} packed bytes; expected at least 1171.`);
  }
  const attempts=[];
  for(const offset of [0,2]){
    if(payload.length<offset+1171)continue;
    const packed=payload.subarray(offset,offset+1171);
    if(packed.some(value=>value>0x7f)){attempts.push(`${offset}: non-MIDI byte`);continue;}
    const program=new Uint8Array(PROGRAM_BYTES);
    let source=0,target=0;
    while(target<program.length){
      const prefix=packed[source++];
      const count=Math.min(7,program.length-target);
      for(let bit=0;bit<count;bit++)program[target++]=packed[source++]|(((prefix>>bit)&1)<<7);
    }
    if(program[0]===0x50&&program[1]===0x52&&program[2]===0x4f&&program[3]===0x47)return program;
    const preview=Array.from(program.subarray(0,8),value=>value.toString(16).padStart(2,'0')).join(' ');
    attempts.push(`${offset}: ${preview}`);
  }
  const rawPreview=Array.from(payload.subarray(0,12),value=>value.toString(16).padStart(2,'0')).join(' ');
  throw new Error(`Program ${slot+1} dump layout was not recognized (frame ${bytes.length} bytes; payload ${payload.length}; raw ${rawPreview}; decoded ${attempts.join(' / ')}).`);
}

function waitForDump(input, channel, slot, timeoutMs, signal) {
  let cancel;
  const promise = new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      input.removeEventListener('midimessage', onMessage);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('Transfer canceled.'));
    };
    const onMessage = event => {
      try {
        const program = decodeProgramDump(event.data, channel, slot);
        if (!program) return;
        cleanup();
        resolve(program);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`No program data arrived for slot ${slot + 1}. Check the MIDI connection and synth channel.`));
    }, timeoutMs);
    cancel = error => {
      if (settled) return;
      cleanup();
      reject(error);
    };
    input.addEventListener('midimessage', onMessage);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, {once: true});
  });
  return {promise, cancel: error => cancel?.(error)};
}

async function findChannel({input, output, slot, onStatus, signal, timeoutMs = 900}) {
  for(let channel=0;channel<16;channel++){
    if(signal?.aborted)throw new Error('Transfer canceled.');
    onStatus?.(`Finding synth channel · trying ${channel+1} of 16…`);
    const response=waitForDump(input,channel,slot,timeoutMs,signal);
    try{
      output.send(buildProgramRequest(slot,channel));
      return {channel,data:await response.promise};
    }catch(error){
      response.cancel(error);
      if(error.message==='Transfer canceled.')throw error;
      if(error.message.startsWith('No program data arrived'))continue;
      throw error;
    }
  }
  throw new Error('No reply on MIDI channels 1–16. Check the synth’s MIDI Ch setting and MIDI Route.');
}

export async function receivePrograms({input, output, firstSlot, lastSlot, onProgress, onStatus, signal, timeoutMs = 3000}) {
  if (!input || !output) throw new Error('Choose both a MIDI input and output.');
  if (!Number.isInteger(firstSlot) || !Number.isInteger(lastSlot) ||
      firstSlot < 0 || lastSlot > 499 || firstSlot > lastSlot) {
    throw new RangeError('Choose a valid program range from 1 to 500.');
  }

  const received=[];
  const found=await findChannel({input,output,slot:firstSlot,onStatus,signal});
  const channel=found.channel;
  received.push({slot:firstSlot,data:Array.from(found.data)});
  onProgress?.({received:1,total:lastSlot-firstSlot+1,slot:firstSlot,channel});
  for (let slot = firstSlot+1; slot <= lastSlot; slot++) {
    if (signal?.aborted) throw Object.assign(new Error('Transfer canceled.'), {received});
    const response = waitForDump(input, channel, slot, timeoutMs, signal);
    try {
      output.send(buildProgramRequest(slot, channel));
      const data = await response.promise;
      received.push({slot, data: Array.from(data)});
      onProgress?.({received: received.length, total: lastSlot - firstSlot + 1, slot, channel});
    } catch (error) {
      response.cancel(error);
      throw Object.assign(error, {received});
    }
  }
  return received;
}
