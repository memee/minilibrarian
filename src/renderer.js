import {receivePrograms} from './sysex.js';

const $=(selector)=>document.querySelector(selector);
const state={programs:[],selected:null,source:'No library open',tab:'settings',midiAccess:null,midiInput:null,midiOutput:null,receiveController:null};
let groups=[];
const list=$('#program-list'), search=$('#search');
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function label(key){return key.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}

function renderList(){
  const query=search.value.trim().toLocaleLowerCase();
  const filtered=state.programs.filter(p=>!query||`${p.name} ${p.programmer} ${p.comment}`.toLocaleLowerCase().includes(query));
  list.replaceChildren();
  for(const program of filtered){
    const row=node('button',`program-row${state.selected?.id===program.id?' selected':''}`);
    row.type='button';
    row.append(node('span','program-index',String(program.index+1).padStart(3,'0')));
    row.append(node('span','program-row-name',program.name));
    row.addEventListener('click',()=>selectProgram(program));
    list.append(row);
  }
  $('#program-count').textContent=state.programs.length?String(state.programs.length):'';
}

function selectProgram(program){state.selected=program;renderList();renderDetail();}

function renderDetail(){
  const program=state.selected;
  $('#empty-state').classList.toggle('hidden',!!program);
  $('#program-view').classList.toggle('hidden',!program);
  if(!program)return;
  $('#program-position').textContent=`PROGRAM ${(program.index+1).toString().padStart(3,'0')}`;
  $('#program-name').textContent=program.name;
  $('#program-meta').textContent=program.programmer||'minilogue xd program';
  const comment=$('#program-comment');comment.textContent=program.comment;comment.classList.toggle('hidden',!program.comment);
  $('#settings-panel').classList.toggle('hidden',state.tab!=='settings');
  $('#sequence-panel').classList.toggle('hidden',state.tab!=='sequencer');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===state.tab));
  renderSettings(program);renderSequence(program.sequence);
}

function renderSettings(program){
  const panel=$('#settings-panel');panel.replaceChildren();
  for(const [title,keys] of groups){
    const rows=keys.filter(k=>program.parameters[k]!==undefined);
    if(!rows.length)continue;
    const card=node('section','setting-card');card.append(node('h2','',title));
    for(const key of rows){const row=node('div','setting-row');row.append(node('span','',label(key)),node('span','',String(program.parameters[key])));card.append(row);}
    panel.append(card);
  }
  const types=Array.from({length:6},(_,i)=>`user_parameter_${i+1}_type`).filter(k=>program.parameters[k]!==undefined);
  if(types.length){
    const card=node('section','setting-card');card.append(node('h2','','User parameter types'));
    for(const key of types){const row=node('div','setting-row');row.append(node('span','',label(key)),node('span','',String(program.parameters[key])));card.append(row);}
    panel.append(card);
  }
  panel.append(node('div','raw-note','Values are raw stored numbers; synth display conversions are not applied.'));
}

function renderSequence(sequence){
  const panel=$('#sequence-panel');panel.replaceChildren();
  if(!sequence){panel.append(node('div','no-sequence','No recognized sequencer data in this program.'));return;}
  const metrics=node('div','sequence-metrics');
  for(const [title,value] of [['Tempo',`${sequence.tempo.toFixed(1)} BPM`],['Length',`${sequence.length} steps`],['Resolution',sequence.resolution],['Swing (raw)',sequence.swingRaw],['Format',sequence.header==='SEQD'?'Legacy SEQD':'SQ']]){
    const metric=node('div','metric');metric.append(node('label','',title),node('strong','',String(value)));metrics.append(metric);
  }
  panel.append(metrics);
  const grid=node('div','step-grid');
  for(const step of sequence.steps){
    const card=node('article','step-card');
    const head=node('div','step-head');head.append(node('span','step-num',String(step.number).padStart(2,'0')));
    const flags=node('span','flags');
    for(const [name,on] of [['active',step.active],['play',step.enabled],['motion',step.motionEnabled]]){const f=node('span',`flag${on?' on':''}`,name);flags.append(f);}
    head.append(flags);card.append(head,node('div',`step-rule${step.enabled?' on':''}`));
    const notes=step.notes.filter(n=>n.hasEvent);
    if(notes.length){for(const note of notes)card.append(node('div','note-line',`N${note.note} · velocity ${note.velocity}${note.trigger?' · trigger':''}${note.gate>72?' · tie':''}`));}
    else card.append(node('div','step-empty','No note events'));
    const motions=step.motions.filter(m=>m.enabled&&m.stepEnabled);
    for(const motion of motions){card.append(node('div','motion-line',`${motion.target??`Target ${motion.parameterID}`}: ${motion.values.join(' · ')}`));}
    grid.append(card);
  }
  panel.append(grid);
  if(sequence.warnings.length){const w=node('div','sequence-warning',sequence.warnings.join(' · '));panel.append(w);}
  panel.append(node('p','raw-note','Stored events are shown, including events on disabled steps. Playback is not simulated.'));
}

let toastTimer;
function toast(message){const el=$('#toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),4500);}

async function openLibrary(){
  try{
    const result=await window.miniLibrarian.openLibrary();
    if(!result)return;
    state.programs=result.programs;state.source=result.source;state.selected=state.programs[0]??null;
    $('#source-name').textContent=state.source;search.value='';renderList();renderDetail();
    if(!state.programs.length)toast('No programs found in the selected file.');
  }catch(error){toast(error.message??String(error));}
}

$('#open-library').addEventListener('click',openLibrary);
$('#empty-open').addEventListener('click',openLibrary);
search.addEventListener('input',renderList);
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{state.tab=tab.dataset.tab;renderDetail();}));
$('#export-program').addEventListener('click',async()=>{
  if(!state.selected)return;
  try{const saved=await window.miniLibrarian.exportProgram(state.selected.id,state.selected.name);if(saved)toast('Program exported.');}
  catch(error){toast(error.message??String(error));}
});

function setMidiStatus(message,kind=''){
  const el=$('#midi-status');el.textContent=message;el.className=`midi-status${kind?' '+kind:''}`;
}

function refreshMidiPorts(){
  const access=state.midiAccess;
  if(!access)return;
  const inputs=Array.from(access.inputs.values()),outputs=Array.from(access.outputs.values());
  $('#connect-midi').textContent='Refresh';
  const isXDPort=(port)=>/korg|minilogue\s*xd/i.test(`${port.name||''} ${port.manufacturer||''}`);
  state.midiInput=inputs.find(port=>isXDPort(port)&&/kbd\s*\/\s*knob/i.test(port.name||''))??null;
  state.midiOutput=outputs.find(port=>isXDPort(port)&&/sound/i.test(port.name||''))??null;
  const inputStatus=$('#midi-input-status'),outputStatus=$('#midi-output-status');
  inputStatus.textContent=state.midiInput?.name??'minilogue xd input not detected';
  outputStatus.textContent=state.midiOutput?.name??'minilogue xd output not detected';
  inputStatus.parentElement.classList.toggle('detected',!!state.midiInput);
  outputStatus.parentElement.classList.toggle('detected',!!state.midiOutput);
  $('#receive-programs').disabled=!state.midiInput||!state.midiOutput||!!state.receiveController;
  if(state.receiveController)return;
  if(state.midiInput&&state.midiOutput)setMidiStatus('minilogue xd detected. MIDI channel will be found automatically.');
  else if(!inputs.length&&!outputs.length)setMidiStatus('Connect the minilogue xd by USB to detect it.');
  else setMidiStatus(`minilogue xd ${!state.midiInput?'input':'output'} not detected. Check the USB connection and MIDI Route.`,'error');
}

async function connectMidi(){
  try{
    if(state.midiAccess){refreshMidiPorts();return;}
    if(!navigator.requestMIDIAccess)throw new Error('This Electron build does not expose Web MIDI.');
    setMidiStatus('Requesting MIDI and SysEx access…');
    state.midiAccess=await navigator.requestMIDIAccess({sysex:true});
    state.midiAccess.onstatechange=refreshMidiPorts;
    refreshMidiPorts();
  }catch(error){
    setMidiStatus(error.message??String(error),'error');
  }
}

$('#connect-midi').addEventListener('click',connectMidi);
$('#receive-programs').addEventListener('click',async()=>{
  if(!state.midiAccess){await connectMidi();if(!state.midiAccess)return;}
  const first=Number($('#range-start').value),last=Number($('#range-end').value);
  if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last>500||first>last){setMidiStatus('Choose a program range from 1 to 500.','error');return;}
  const input=state.midiInput,output=state.midiOutput;
  if(!input||!output){refreshMidiPorts();return;}
  const total=last-first+1;
  const progress=$('#receive-progress');progress.max=total;progress.value=0;progress.classList.remove('hidden');
  state.receiveController=new AbortController();
  $('#receive-programs').disabled=true;$('#connect-midi').disabled=true;$('#cancel-receive').classList.remove('hidden');
  setMidiStatus(`Finding synth channel for program ${first}…`);
  try{
    await Promise.all([input.open(),output.open()]);
    const received=await receivePrograms({input,output,firstSlot:first-1,lastSlot:last-1,signal:state.receiveController.signal,onStatus:setMidiStatus,onProgress:({received:count,slot,channel})=>{progress.value=count;setMidiStatus(`Channel ${channel+1} · received program ${slot+1} · ${count} of ${total}`);}});
    setMidiStatus('Transfer complete. Choose where to save the received sounds…');
    const saved=await window.miniLibrarian.saveReceivedPrograms(received);
    if(!saved){setMidiStatus('Transfer finished, but the save dialog was canceled. Receive again when ready.');return;}
    state.programs=saved.programs;state.source=saved.path;state.selected=state.programs[0]??null;search.value='';
    $('#source-name').textContent=state.source;renderList();renderDetail();
    setMidiStatus(`Saved ${saved.count} program${saved.count===1?'':'s'} to ${saved.path}.`,'success');
  }catch(error){
    if(error.message==='Transfer canceled.')setMidiStatus('Transfer canceled. No file was saved.');
    else setMidiStatus(error.message??String(error),'error');
  }finally{
    state.receiveController=null;$('#connect-midi').disabled=false;$('#cancel-receive').classList.add('hidden');
    const ready=!!state.midiInput&&!!state.midiOutput;
    $('#receive-programs').disabled=!ready;
  }
});

$('#cancel-receive').addEventListener('click',()=>state.receiveController?.abort());

window.miniLibrarian.getGroups().then(value=>{groups=value;if(state.selected)renderDetail();});
