const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {ProjectMap,projectView}=require('../src/project-map.cjs');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora-map-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const write=async(file,text)=>{await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),text);};await write('project.godot','config_version=5\n[application]\nrun/main_scene="uid://menuscene"\n[autoload]\nSession="*res://scripts/session.gd"\n');await write('scenes/menu.tscn','[gd_scene load_steps=3 format=3 uid="uid://menuscene"]\n[ext_resource type="Script" path="res://scripts/menu.gd" uid="uid://menuscript" id="1"]\n[ext_resource type="Theme" path="res://ui/theme.tres" id="2"]\n[ext_resource type="Texture2D" path="res://assets/missing.png" id="3"]\n');await write('scripts/menu.gd','extends "base.gd"\nclass_name Menu\n# load("res://fake-comment.gd")\n"""res://fake-docstring.gd"""\nconst Theme = preload("res://ui/theme.tres")\nsignal opened\nfunc show_menu():\n  var dynamic = load("res://levels/" + str(1) + ".tscn")\n');await write('scripts/base.gd','extends Control\n');await write('scripts/session.gd','extends Node\n');await write('scripts/menu.gd.uid','uid://menuscript\n');await write('ui/theme.tres','[gd_resource type="Theme" format=3]\n');await write('.godot/private.gd','load("res://hidden.gd")');return {root,write};}
test('Godot map resolves main UID, scenes, autoload, relative inheritance and source lines without comment/docstring edges',async t=>{
 const {root}=await fixture(t);const map=await new ProjectMap(root).scan();assert.equal(map.main,'scenes/menu.tscn');assert.equal(map.summary.scenes,1);assert.equal(map.summary.scripts,3);assert.equal(map.summary.missing,1);assert.ok(map.edges.some(e=>e.kind==='autoload'&&e.to==='scripts/session.gd'));assert.ok(map.edges.some(e=>e.from==='scripts/menu.gd'&&e.to==='scripts/base.gd'&&e.kind==='extends'));assert.ok(!map.edges.some(e=>/fake|hidden/.test(e.to)));assert.ok(!map.edges.some(e=>e.from===e.to));
 const focus=projectView(map,{file:'scripts/menu.gd'});assert.equal(focus.incoming[0].from,'scenes/menu.tscn');assert.equal(focus.incoming[0].line,2);assert.equal(focus.selected.functions[0].name,'show_menu');assert.equal(focus.selected.signals[0].name,'opened');assert.equal(focus.selected.dynamic,1);assert.equal(focus.selected.class_name,'Menu');assert.equal(focus.unresolved.length,0);
});
test('Map reuses unchanged parse results and reflects changed/deleted files independently of Opora state',async t=>{
 const {root,write}=await fixture(t);const scanner=new ProjectMap(root);const first=await scanner.scan(),again=await scanner.scan();assert.equal(again.map_revision,first.map_revision);assert.equal(again.summary.read,0);assert.ok(again.summary.reused>0);await write('scripts/base.gd','extends Node\nfunc changed():\n  pass\n');const changed=await scanner.scan();assert.notEqual(changed.map_revision,first.map_revision);assert.equal(changed.summary.read,1);await fs.rm(path.join(root,'ui/theme.tres'));const removed=await scanner.scan();assert.equal(removed.summary.missing,3);assert.equal(projectView(removed,{file:'ui/theme.tres'}).selected.exists,false);
});
test('Map filters, pagination and reference direction are explicit; unsafe and unknown focus paths are rejected',async t=>{
 const {root}=await fixture(t);const map=await new ProjectMap(root).scan();const scripts=projectView(map,{kind:'script',limit:1});assert.equal(scripts.total,3);assert.equal(scripts.files.length,1);assert.notEqual(projectView(map,{kind:'script',limit:1,offset:1}).files[0].file,scripts.files[0].file);assert.equal(projectView(map,{query:'Menu'}).total,3);assert.equal(projectView(map,{file:'ui/theme.tres'}).incoming_total,2);assert.throws(()=>projectView(map,{file:'../secrets'}));assert.throws(()=>projectView(map,{file:'no-such-file.gd'}));assert.throws(()=>projectView(map,{limit:1000}));
});
test('Map skips symlinks and reports bounded, incomplete scans without claiming excluded targets are missing',async t=>{
 const {root}=await fixture(t);await fs.symlink(path.join(root,'scripts/menu.gd'),path.join(root,'linked.gd'));const map=await new ProjectMap(root,{files:2}).scan();assert.ok(map.summary.limited);assert.ok(map.warnings.some(w=>w.includes('неполная')));assert.ok(!map.nodes.some(n=>n.file==='linked.gd'));assert.ok(!map.edges.some(e=>e.missing&&e.to!=='assets/missing.png'));assert.ok(map.edges.some(e=>e.unindexed));
});
test('System overview groups folders without changing inventory and counts real cross-system references',async t=>{
 const {root,write}=await fixture(t);await write('combat/arena.tscn','[gd_scene format=3]\n[ext_resource path="res://characters/player.tscn" type="PackedScene" id="1"]\n');await write('characters/player.tscn','[gd_scene format=3]\n');await write('combat/combat.gd','extends Node\n');
 const map=await new ProjectMap(root).scan(),before=JSON.stringify(map),overview=projectView(map,{view:'systems',limit:2});
 assert.equal(overview.systems.length,2);assert.ok(overview.systems_total>2);assert.equal(new Set(overview.systems.map(g=>g.id)).size,2);
 const all=projectView(map,{view:'systems',limit:100});assert.equal(all.systems.reduce((sum,g)=>sum+g.files,0),map.summary.files);
 const combat=all.systems.find(g=>g.id==='combat');assert.equal(combat.scenes,1);assert.equal(combat.scripts,1);assert.equal(combat.entry,'combat/arena.tscn');assert.ok(all.system_links.some(e=>e.from==='combat'&&e.to==='characters'&&e.count===1));
 const group=projectView(map,{system:'combat'});assert.equal(group.total,2);assert.ok(group.files.every(n=>n.system_id==='combat'));
 const selected=projectView(map,{file:'combat/arena.tscn',system:'combat'});assert.equal(selected.outgoing[0].node.system_id,'characters');
 assert.equal(JSON.stringify(map),before);assert.throws(()=>projectView(map,{view:'unknown'}));
});
test('Local class inheritance does not mutate cached references across repeated scans',async t=>{
 const {root,write}=await fixture(t);await write('scripts/derived.gd','extends Menu\n');const scanner=new ProjectMap(root),first=await scanner.scan();for(let i=0;i<3;i++){const map=await scanner.scan();assert.equal(map.map_revision,first.map_revision);assert.equal(map.edges.filter(e=>e.from==='scripts/derived.gd'&&e.to==='scripts/menu.gd').length,1);}
});
test('Large system boards paginate without dropping groups or claiming off-page links are absent',()=>{
 const nodes=Array.from({length:61},(_,i)=>({file:`module_${i}/unit.gd`,kind:'script',exists:true})),edges=nodes.slice(1).map((n,i)=>({from:nodes[i].file,to:n.file,kind:'load',line:1}));
 const map={nodes,edges,main:null,summary:{files:61},warnings:[],unresolved:[],limits:{}};
 const pages=[0,24,48].map(offset=>projectView(map,{view:'systems',offset,limit:24}));
 assert.deepEqual(pages.map(p=>p.systems.length),[24,24,13]);assert.equal(new Set(pages.flatMap(p=>p.systems.map(g=>g.id))).size,61);
 assert.equal(pages[0].system_links_total,60);assert.ok(pages[0].system_links.length<60);
 assert.equal(projectView(map,{view:'systems',query:'module_60'}).systems_total,1);
});
