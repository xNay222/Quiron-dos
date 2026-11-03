// Pruebas de los arreglos de la auditoría del 02/11/2026 (permisos de la nube, alta y cuenta, códigos de paciente…), con DOM simulado.
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'); const dir = path.join(root, 'quiron');
const nodes = new Map(); const node = id => { if (!nodes.has(id)) nodes.set(id, { value:'', checked:false, innerHTML:'', textContent:'', dataset:{}, style:{}, hidden:false, remove(){}, setAttribute(){}, removeAttribute(){}, addEventListener(){}, querySelector(){return null}, querySelectorAll(){return []}, classList:{add(){},remove(){},toggle(){}}, focus(){}, setSelectionRange(){} }); return nodes.get(id); };
const storage = new Map(); const ctx = vm.createContext({ console, Blob, URL, TextEncoder, Uint8Array, Date, Math, JSON, assert, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,removeItem(){}},document:{getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},documentElement:node('html'),body:node('body')},setInterval(){},setTimeout(){},clearTimeout(){},addEventListener(){},matchMedia:()=>({matches:false}),location:{hash:''},crypto:require('node:crypto').webcrypto,fetch:async()=>({ok:false}),requestAnimationFrame(){} }); ctx.window=ctx;
const run = code => vm.runInContext(code, ctx);
const html = fs.readFileSync(path.join(dir, 'index.html'),'utf8');
for (const [,name] of html.matchAll(/<script src="([^"/:]+\.js)"/g)) { let code=fs.readFileSync(path.join(dir,name),'utf8'); if(name==='app.js') code=code.slice(0,code.indexOf('(function start()')); vm.runInContext(code,ctx,{filename:name}); }
run("S.users=[{id:'uA',name:'Administración',role:'admin',status:'activo'}]; applyUser(S.users[0]); render=()=>{}; renderSide=()=>{}; closeSheet=()=>{}; window.toasts=[]; toast=m=>toasts.push(m); openSheet=(title,body,footer)=>{window.lastSheet={title,body,footer}}; refreshSheet=(body,footer)=>{window.lastSheet={...lastSheet,body,footer}}; save=()=>true;");
const checks=[]; const test=(name,code)=>{run('{'+code+'}');checks.push(name);};
const as = (r, doc = null) => `S.session={uid:'u-${r}',role:'${r}',doc:${doc ? `'${doc}'` : 'null'},name:'Prueba'};`;

test('Alta por un médico: alta clínica sin precios ni cuenta; queda para Administración', `
  const a=S.admissions.find(x=>x.status==='ingresado'); window.adm=a; const doc=a.doc; window.invN=S.invoices.length;
  ${'S.session={uid:"u-m",role:"medico",doc:a.doc,name:"Dr"};'}
  ACTIONS.discharge({dataset:{id:a.id}});
  assert.ok(!/Total de la estancia|Excedentes a cobrar|Presupuesto de esta hospitalización/.test(lastSheet.body),'el médico no ve precios ni presupuestos');
  assert.ok(lastSheet.body.includes('Administración hará la cuenta'));
  ACTIONS.dischargeSave({dataset:{id:a.id}});
  assert.equal(a.status,'alta'); assert.equal(a.billPending,true); assert.equal(S.invoices.length,invN,'no crea cuenta');
  assert.ok(toasts.at(-1).includes('Administración'));`);
test('Administración ve el alta por cobrar y registra la cuenta una sola vez', `
  ${as('admin')} const before=navCount('contabilidad'); UI.acTab='confirmar';
  assert.ok(VIEWS.contabilidad().includes('Altas por cobrar')); assert.ok(VIEWS.contabilidad().includes('data-act="dcBill" data-id="'+adm.id+'"'));
  ACTIONS.dcBill({dataset:{id:adm.id}}); assert.ok(/Total de la estancia|Excedentes a cobrar|Sin cargos adicionales/.test(lastSheet.body),'aquí sí se ven los montos');
  ACTIONS.dcBillSave({dataset:{id:adm.id}});
  assert.equal(adm.billPending,undefined); assert.ok(adm.inv || toasts.at(-1).includes('sin cargos'));
  assert.equal(navCount('contabilidad'),before-1); assert.ok(!VIEWS.contabilidad().includes('data-act="dcBill"'));
  const n=S.invoices.length; ACTIONS.dcBillSave({dataset:{id:adm.id}}); assert.equal(S.invoices.length,n,'no se cobra dos veces');`);
test('Alta por Administración: sigue cobrando en el mismo paso', `
  ${as('admin')} const a=S.admissions.find(x=>x.status==='ingresado'); if(a){ ACTIONS.discharge({dataset:{id:a.id}}); assert.ok(/Total de la estancia|Excedentes a cobrar|Sin cargos adicionales/.test(lastSheet.body));
  ACTIONS.dischargeSave({dataset:{id:a.id}}); assert.equal(a.status,'alta'); assert.ok(!a.billPending); }`);
test('Códigos QRN: no se repiten al eliminar un paciente', `
  const codes=new Set(S.patients.map(p=>p.code)); const last=S.patients.reduce((m,p)=>Math.max(m,codeNum(p.code)),0);
  S.deletedPatients=[{code:'QRN-'+String(last+5).padStart(6,'0'),name:'Eliminado'}];
  const c=nextPatCode(); assert.equal(codeNum(c),last+6); assert.ok(!codes.has(c)); assert.equal(S.patSeq,last+7);
  const c2=nextPatCode(); assert.equal(codeNum(c2),last+7,'el siguiente sigue el contador');`);
test('Inicio: solo avisos de secciones que el usuario tiene (Almacén)', `
  ${as('almacen')} S.exams[0].priority='urgente'; S.exams[0].status='solicitado'; const h=VIEWS.inicio();
  for(const g of h.matchAll(/data-go="([^"]+)"/g)) assert.ok(canSee(g[1]),'enlace a '+g[1]);
  ${as('admin')} assert.ok(VIEWS.inicio().includes('examen'));`);
test('Contadores del menú del anestesiólogo: solo sus cirugías y pacientes', `
  const doc=S.doctors[0].id; S.session={uid:'u-an',role:'anestesiologo',doc,name:'An'};
  const mine=S.admissions.filter(a=>a.status==='ingresado'&&AREAS[admArea(a)].route==='hospitalizacion'&&a.doc===doc).length;
  assert.equal(navCount('hospitalizacion'),mine); ${as('admin')}`);
test('Recepción: lista de consultas con el resumen sin datos clínicos', `
  ${as('recepcion')} const saved=S.consults; S.consults=saved.slice(0,3).map(c=>({id:c.id,pid:c.pid,doc:c.doc,date:c.date,time:c.time,status:c.status,specialty:c.specialty,type:c.type,apptId:c.apptId,reasons:[],dx:[]}));
  const h=VIEWS.consultas(); assert.ok(h.length>100); assert.ok(!/undefined|\\[object/.test(h)); S.consults=saved; ${as('admin')}`);
// Nube: lo que la aplicación permite y lo que permite la base de datos coinciden
const cloud = fs.readFileSync(path.join(dir,'cloud.js'),'utf8'); const mig = fs.readFileSync(path.join(root,'supabase/migrations/20261102000008_auditoria.sql'),'utf8');
test('Nube: ajustes por rol iguales en la aplicación y en la base de datos', `
  for (const [rol,keys] of Object.entries(NUBE_AJ_ROL)) for (const k of keys) if (!['duty','nurseWeek'].includes(k)) assert.ok(${JSON.stringify(mig)}.includes("('"+k+"', '"+rol+"')"),k+' '+rol);
  assert.ok(NUBE_AJ_ROL.laboratorio.includes('labCatalog')); assert.equal(typeof nubeDenied,'function');`);
assert.ok(/'pacientes' and not 'enfermeria'/.test(mig) && mig.includes("array['enfermeria_plus', 'enfermeria']")); checks.push('Nube: enfermería guarda los pacientes que registra en el triaje');
assert.ok(mig.includes('consultas_resumen') && !/'reasons'|'dx'|'plan'|'exam'/.test(mig.slice(mig.indexOf('consultas_resumen'), mig.indexOf('revoke execute')))); checks.push('Nube: el resumen de consultas no lleva contenido clínico');
assert.ok(cloud.includes("nubeAll('contadores'")); checks.push('Nube: la numeración se sigue desde el contador del servidor');
const app = fs.readFileSync(path.join(dir,'app.js'),'utf8'); assert.ok(app.lastIndexOf('(function start()') > app.indexOf('const motionCard')); checks.push('Arranque al final de app.js');
const csp = JSON.parse(fs.readFileSync(path.join(dir,'vercel.json'),'utf8')).headers[0].headers[0].value;
assert.ok(!/https:\/\/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)[ ;]/.test(csp)); checks.push('Seguridad: scripts externos limitados a las librerías que se usan');
console.log(checks.map(n=>'OK '+n).join('\n'));console.log(checks.length+' grupos de pruebas correctos.');
