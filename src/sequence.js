import { motionNames } from './parameters.js';

const u16 = (d, i) => d.readUInt16LE(i);

export function decodeSequence(data) {
  if (data.subarray(160,164).toString('ascii') === 'SEQD') return build(data, 'SEQD', 0xffff);
  if (data.subarray(160,162).toString('ascii') === 'SQ') return build(data, 'SQ', u16(data,162));
  return null;
}

function build(data, header, activeMask) {
  const enabledMask=u16(data,170), motionMask=u16(data,172), tempoRaw=u16(data,164);
  const resolution=data[167];
  const warnings=[];
  if (tempoRaw<100||tempoRaw>3000) warnings.push(`Tempo raw value ${tempoRaw} is outside 100–3000`);
  if (data[166]<1||data[166]>16) warnings.push(`Step length ${data[166]} is outside 1–16`);
  if (resolution>4) warnings.push(`Unknown step resolution ${resolution}`);
  const slots=Array.from({length:4},(_,i)=>({slot:i+1,enabled:!!(data[174+i*2]&1),smooth:!!(data[174+i*2]&2),parameterID:data[175+i*2],stepMask:u16(data,182+i*2)}));
  const steps=Array.from({length:16},(_,i)=>{
    const base=190+i*52;
    const notes=Array.from({length:8},(_,j)=>{
      const gate=data[base+16+j];
      return {slot:j+1,note:data[base+j],velocity:data[base+8+j],hasEvent:data[base+8+j]!==0,gate:gate&127,trigger:!!(gate&128)};
    });
    const motions=Array.from({length:4},(_,j)=>{
      const o=base+24+j*7, low=data[o+5]|(data[o+6]<<8);
      const values=Array.from({length:5},(_,k)=>(data[o+k]<<2)|((low>>(2*k))&3));
      return {...slots[j],stepEnabled:!!(slots[j].stepMask&(1<<i)),target:motionNames[slots[j].parameterID]??null,values};
    });
    return {number:i+1,active:!!(activeMask&(1<<i)),enabled:!!(enabledMask&(1<<i)),motionEnabled:!!(motionMask&(1<<i)),notes,motions};
  });
  return {header,tempo:tempoRaw/10,length:data[166],resolution:['1/16','1/8','1/4','1/2','1/1'][resolution]??`Unknown (${resolution})`,swingRaw:data[168],steps,warnings};
}
