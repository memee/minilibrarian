import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { randomUUID } from 'node:crypto';
import { decodeParameters } from './parameters.js';
import { decodeSequence } from './sequence.js';

const xmlParser=new XMLParser({ignoreAttributes:false,parseTagValue:false,isArray:(name)=>name==='ProgramData'});
const text=(value)=>typeof value==='string'?value.trim():'';
const safeMember=(name)=>typeof name==='string'&&name.length>0&&!name.split(/[\\/]/).includes('..')&&!name.startsWith('/')&&!name.startsWith('\\');

export function readLibrary(filePath) {
  const archive=new AdmZip(filePath);
  const entries=archive.getEntries();
  if(new Set(entries.map(e=>e.entryName)).size!==entries.length) throw new Error('Archive contains duplicate file names.');
  const manifestEntry=archive.getEntry('FileInformation.xml');
  if(!manifestEntry) throw new Error('FileInformation.xml is missing from the archive.');
  const manifest=xmlParser.parse(manifestEntry.getData().toString('utf8'));
  const root=manifest.KorgMSLibrarian_Data??manifest;
  const product=text(root.Product);
  if(product!=='minilogue xd') throw new Error(`This library is for ${product||'an unknown product'}, not minilogue xd.`);
  const contents=root.Contents;
  const records=contents?.ProgramData??[];
  if(!Array.isArray(records)||records.length===0) throw new Error('No program records were found in the archive.');
  return records.map((entry,index)=>{
    const binaryName=text(entry.ProgramBinary), infoName=text(entry.Information);
    if(!safeMember(binaryName)||!safeMember(infoName)) throw new Error(`Program ${index+1} has an unsafe archive path.`);
    const binaryEntry=archive.getEntry(binaryName), infoEntry=archive.getEntry(infoName);
    if(!binaryEntry) throw new Error(`Program binary is missing: ${binaryName}`);
    const data=binaryEntry.getData();
    if(data.length!==1024||data.subarray(0,4).toString('ascii')!=='PROG') throw new Error(`${binaryName} is not a 1,024-byte PROG record.`);
    let info={};
    if(infoEntry){
      const parsed=xmlParser.parse(infoEntry.getData().toString('utf8'));
      info=parsed.xd_ProgramInformation??parsed;
    }
    const name=data.subarray(4,16).toString('ascii').split('\0')[0].trim()||`Program ${index+1}`;
    return {id:randomUUID(),index,name,binaryName,infoName,programmer:text(info.Programmer),comment:text(info.Comment),parameters:decodeParameters(data),sequence:decodeSequence(data)};
  });
}

export function exportProgram(archive, program, outputPath) {
  const infoName='Prog_000.prog_info', binaryName='Prog_000.prog_bin';
  const escape=(s)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const info=`<?xml version="1.0" encoding="UTF-8"?>\n<xd_ProgramInformation>\n  <Programmer>${escape(program.programmer)}</Programmer>\n  <Comment>${escape(program.comment)}</Comment>\n</xd_ProgramInformation>\n`;
  const manifest=`<?xml version="1.0" encoding="UTF-8"?>\n<KorgMSLibrarian_Data>\n  <Product>minilogue xd</Product>\n  <Contents NumFavoriteData="0" NumProgramData="1" NumPresetInformation="0" NumTuneScaleData="0" NumTuneOctData="0">\n    <ProgramData><Information>${infoName}</Information><ProgramBinary>${binaryName}</ProgramBinary></ProgramData>\n  </Contents>\n</KorgMSLibrarian_Data>\n`;
  const out=new AdmZip();
  out.addFile('FileInformation.xml',Buffer.from(manifest,'utf8'));
  out.addFile(infoName,Buffer.from(info,'utf8'));
  out.addFile(binaryName,archive.getEntry(program.binaryName).getData());
  out.writeZip(outputPath);
}

export function exportReceivedPrograms(received, outputPath) {
  if (!Array.isArray(received) || received.length === 0) {
    throw new Error('There are no received programs to save.');
  }
  const seen = new Set();
  const records = received.map(({slot, data}) => {
    if (!Number.isInteger(slot) || slot < 0 || slot > 499 || seen.has(slot)) {
      throw new Error('Received program slots are invalid or duplicated.');
    }
    seen.add(slot);
    const bytes = Buffer.from(data);
    if (bytes.length !== 1024 || bytes.toString('ascii', 0, 4) !== 'PROG') {
      throw new Error(`Program ${slot + 1} is not a valid minilogue xd program record.`);
    }
    const stem = `Prog_${String(slot).padStart(3, '0')}`;
    return {slot, bytes, stem};
  }).sort((a, b) => a.slot - b.slot);

  const archive = new AdmZip();
  const programXml = records.map(({stem}) =>
    `    <ProgramData><Information>${stem}.prog_info</Information><ProgramBinary>${stem}.prog_bin</ProgramBinary></ProgramData>`
  ).join('\n');
  const isSingleProgram = records.length === 1;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>\n<KorgMSLibrarian_Data>\n  <Product>minilogue xd</Product>\n  <Contents NumFavoriteData="0" NumProgramData="${records.length}" NumPresetInformation="0" NumTuneScaleData="0" NumTuneOctData="0">\n${programXml}\n  </Contents>\n</KorgMSLibrarian_Data>\n`;
  archive.addFile('FileInformation.xml', Buffer.from(manifest, 'utf8'));
  for (const {stem, bytes} of records) {
    const info = '<?xml version="1.0" encoding="UTF-8"?>\n<xd_ProgramInformation>\n  <Programmer></Programmer>\n  <Comment></Comment>\n</xd_ProgramInformation>\n';
    archive.addFile(`${stem}.prog_info`, Buffer.from(info, 'utf8'));
    archive.addFile(`${stem}.prog_bin`, bytes);
  }
  archive.writeZip(outputPath);
  return {count: records.length, extension: isSingleProgram ? '.mnlgxdprog' : '.mnlgxdlib'};
}
