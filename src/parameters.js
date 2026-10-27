export const wordFields = {
  voice_mode_depth: 19, vco1_pitch: 24, vco1_shape: 26, vco2_pitch: 30,
  vco2_shape: 32, cross_mod_depth: 36, noise_shape: 42, vpm_shape: 44,
  user_shape: 46, noise_shift_shape: 48, vpm_shift_shape: 50,
  user_shift_shape: 52, vco1_level: 54, vco2_level: 56, multi_level: 58,
  filter_cutoff: 60, filter_resonance: 62, amp_eg_attack: 66,
  amp_eg_decay: 68, amp_eg_sustain: 70, amp_eg_release: 72, eg_attack: 74,
  eg_decay: 76, eg_intensity: 78, lfo_rate: 83, lfo_intensity: 85,
  mod_fx_time: 95, mod_fx_depth: 97, delay_time: 101, delay_depth: 103,
  reverb_time: 107, reverb_depth: 109, delay_dry_wet: 151, reverb_dry_wet: 153
};

export const byteFields = {
  octave:[16,0,4],portamento:[17,0,127],key_trigger:[18,0,1],voice_mode_type:[21,1,4],
  vco1_wave:[22,0,2],vco1_octave:[23,0,3],vco2_wave:[28,0,2],vco2_octave:[29,0,3],
  sync:[34,0,1],ring:[35,0,1],multi_type:[38,0,2],noise_type:[39,0,3],vpm_type:[40,0,15],
  user_oscillator:[41,0,15],filter_drive:[64,0,2],filter_keyboard_tracking:[65,0,2],
  eg_target:[80,0,2],lfo_wave:[81,0,2],lfo_mode:[82,0,2],lfo_target:[87,0,2],
  mod_fx_enabled:[88,0,1],mod_fx_type:[89,1,5],chorus_type:[90,0,7],ensemble_type:[91,0,2],
  phaser_type:[92,0,7],flanger_type:[93,0,7],user_mod_fx:[94,0,15],delay_enabled:[99,0,1],
  delay_type:[100,0,19],reverb_enabled:[105,0,1],reverb_type:[106,0,19],
  bend_range_plus:[111,0,12],bend_range_minus:[112,0,12],joystick_assign_plus:[113,0,28],
  joystick_range_plus:[114,0,200],joystick_assign_minus:[115,0,28],joystick_range_minus:[116,0,200],
  cv_mode:[117,0,2],cv1_assign:[118,0,28],cv1_range:[119,0,200],cv2_assign:[120,0,28],
  cv2_range:[121,0,200],micro_tuning:[122,0,139],scale_key:[123,0,24],program_tuning:[124,0,100],
  lfo_key_sync:[125,0,1],lfo_voice_sync:[126,0,1],lfo_target_oscillator:[127,0,3],
  filter_velocity:[128,0,127],amp_velocity:[129,0,127],multi_octave:[130,0,3],multi_routing:[131,0,1],
  eg_legato:[132,0,1],portamento_mode:[133,0,1],portamento_bpm_sync:[134,0,1],program_level:[135,12,132],
  program_transpose:[150,1,25],aftertouch_assign:[155,0,28]
};
for (let i=1;i<=6;i++) byteFields[`vpm_parameter_${i}`]=[135+i,0,200];
for (let i=1;i<=6;i++) byteFields[`user_parameter_${i}`]=[141+i,0,255];

export const groups = [
  ["Program", ["octave","portamento","key_trigger","voice_mode_depth","voice_mode_type","program_level","program_transpose"]],
  ["Oscillators", ["vco1_wave","vco1_octave","vco1_pitch","vco1_shape","vco1_level","vco2_wave","vco2_octave","vco2_pitch","vco2_shape","vco2_level","sync","ring","cross_mod_depth"]],
  ["Multi engine", ["multi_type","noise_type","vpm_type","user_oscillator","multi_octave","multi_routing","noise_shape","vpm_shape","user_shape","noise_shift_shape","vpm_shift_shape","user_shift_shape","multi_level"]],
  ["Filter", ["filter_cutoff","filter_resonance","filter_drive","filter_keyboard_tracking","filter_velocity"]],
  ["Envelopes", ["amp_eg_attack","amp_eg_decay","amp_eg_sustain","amp_eg_release","eg_attack","eg_decay","eg_intensity","eg_target","eg_legato"]],
  ["LFO", ["lfo_wave","lfo_mode","lfo_rate","lfo_intensity","lfo_target","lfo_key_sync","lfo_voice_sync","lfo_target_oscillator"]],
  ["Effects", ["mod_fx_enabled","mod_fx_type","chorus_type","ensemble_type","phaser_type","flanger_type","user_mod_fx","mod_fx_time","mod_fx_depth","delay_enabled","delay_type","delay_time","delay_depth","delay_dry_wet","reverb_enabled","reverb_type","reverb_time","reverb_depth","reverb_dry_wet"]],
  ["Performance and tuning", ["bend_range_plus","bend_range_minus","joystick_assign_plus","joystick_range_plus","joystick_assign_minus","joystick_range_minus","cv_mode","cv1_assign","cv1_range","cv2_assign","cv2_range","micro_tuning","scale_key","program_tuning","aftertouch_assign"]],
  ["User oscillator parameters", ["vpm_parameter_1","vpm_parameter_2","vpm_parameter_3","vpm_parameter_4","vpm_parameter_5","vpm_parameter_6","user_parameter_1","user_parameter_2","user_parameter_3","user_parameter_4","user_parameter_5","user_parameter_6","user_parameter_1_type","user_parameter_2_type","user_parameter_3_type","user_parameter_4_type","user_parameter_5_type","user_parameter_6_type"]]
];

export function decodeParameters(data) {
  const values = {};
  for (const [key, offset] of Object.entries(wordFields)) values[key] = data.readUInt16LE(offset);
  for (const [key, [offset]] of Object.entries(byteFields)) values[key] = data[offset];
  for (let i=0;i<6;i++) {
    const offset=i<4?149:148, shift=i<4?i*2:(i-4)*2;
    values[`user_parameter_${i+1}_type`] = (data[offset] >> shift) & 3;
  }
  return values;
}

export const motionNames = {
  0:"None",15:"Portamento",16:"Voice Mode Depth",17:"Voice Mode Type",18:"VCO 1 Wave",19:"VCO 1 Octave",
  20:"VCO 1 Pitch",21:"VCO 1 Shape",22:"VCO 2 Wave",23:"VCO 2 Octave",24:"VCO 2 Pitch",25:"VCO 2 Shape",
  26:"Sync",27:"Ring",28:"Cross Mod Depth",29:"Multi Engine Type",30:"Multi Engine Noise Type",31:"Multi Engine VPM Type",
  33:"Multi Shape Noise",34:"Multi Shape VPM",35:"Multi Shape User",36:"Multi Shift Noise",37:"Multi Shift VPM",
  38:"Multi Shift User",39:"VCO 1 Level",40:"VCO 2 Level",41:"Multi Engine Level",42:"Cutoff",43:"Resonance",
  45:"Keytrack",46:"Amp EG Attack",47:"Amp EG Decay",48:"Amp EG Sustain",49:"Amp EG Release",50:"EG Attack",
  51:"EG Decay",52:"EG Intensity",53:"EG Target",54:"LFO Wave",55:"LFO Mode",56:"LFO Rate",57:"LFO Intensity",
  58:"LFO Target",59:"Mod FX On/Off",66:"Mod FX Time",67:"Mod FX Depth",68:"Delay On/Off",70:"Delay Time",
  71:"Delay Depth",72:"Reverb On/Off",74:"Reverb Time",75:"Reverb Depth",126:"Pitch Bend",129:"Gate Time"
};
