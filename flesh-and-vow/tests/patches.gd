extends SceneTree
const Updater = preload("res://scripts/updater.gd")
const Boot = preload("res://scripts/patch_boot.gd")
var checks = 0
var failures = 0
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func pack(from: String, to: String, bytes: int = 200) -> Dictionary:
	return {"from":from,"to":to,"url":Updater.ASSET_PREFIX+"flesh-v"+to+"/patch.pck","size":bytes,"sha256":"a".repeat(64)}
func _initialize(): call_deferred("run")
func run():
	var feed = {"version":"0.4.3","url":Updater.ASSET_PREFIX+"flesh-v0.4.3/FleshAndVow.exe","size":110000000,"sha256":"b".repeat(64),"format":2,"runtime":Updater.PATCH_RUNTIME,"snapshot":pack("0.4.0","0.4.3",8000000),"patches":[pack("0.4.0","0.4.1"),pack("0.4.1","0.4.2",300),pack("0.4.2","0.4.3",400)]}
	check(Updater.valid_manifest(feed),"Content feed is accepted")
	var plan = Updater.plan_update(feed,"0.4.0")
	check(plan.kind=="patch" and plan.files.size()==3 and plan.total==900,"Skipped versions download only a complete patch chain")
	plan = Updater.plan_update(feed,"0.4.2")
	check(plan.kind=="patch" and plan.files.size()==1 and plan.total==400,"Already installed patches are not downloaded again")
	plan = Updater.plan_update(feed,"0.4.0",Updater.PATCH_RUNTIME,true)
	check(plan.kind=="snapshot" and plan.total==8000000,"Repair downloads content without the engine")
	plan = Updater.plan_update(feed,"0.3.2")
	check(plan.kind=="snapshot" and plan.total<feed.size,"Missing chain falls back to content only on compatible runtime")
	plan = Updater.plan_update(feed,"0.4.0","different-engine")
	check(plan.kind=="full" and plan.total==feed.size,"Runtime change requires the full installer")
	var changed_boot = feed.duplicate(true)
	changed_boot.bootstrap = "a".repeat(64)+":"+"b".repeat(64)
	check(Updater.valid_manifest(changed_boot),"Bootstrap fingerprint is validated")
	check(Updater.plan_update(changed_boot,"0.4.0").kind=="full","Changed startup settings cannot be applied as an overlay")
	check(Updater.plan_update(changed_boot,"0.4.0",Updater.PATCH_RUNTIME,false,changed_boot.bootstrap).kind=="patch","Matching bootstrap permits file patches")
	var gap = feed.duplicate(true)
	gap.patches.remove_at(1)
	check(Updater.plan_update(gap,"0.4.0").kind=="snapshot","Incomplete route never installs half an update")
	var large = feed.duplicate(true)
	large.patches[0].size = 20000000
	check(Updater.plan_update(large,"0.4.0").kind=="snapshot","Choose the smaller download when many versions were skipped")
	for bad in [{"url":"https://other.test/patch.pck"},{"sha256":"../bad"},{"size":-1},{"size":80.5},{"to":"0.3.9"},{"from":"v0.4.0"}]:
		var invalid = feed.duplicate(true)
		invalid.patches[0].merge(bad,true)
		check(not Updater.valid_manifest(invalid),"Malformed content descriptor rejected")
	var folder = "user://patch-catalog-tests"
	DirAccess.make_dir_recursive_absolute(folder)
	var path = folder.path_join("candidate.pck")
	var f = FileAccess.open(path,FileAccess.WRITE)
	f.store_buffer("GDPC".repeat(100).to_utf8_buffer())
	f.close()
	var descriptor = pack("0.4.0","0.4.1",400)
	descriptor.sha256 = FileAccess.get_sha256(path)
	check(Updater.verify_payload(path,descriptor,true),"Content payload validates PCK header, size and SHA")
	check(not Updater.verify_payload(path,descriptor),"PCK cannot be mistaken for an exe")
	var name: String = descriptor.sha256+".pck"
	DirAccess.rename_absolute(path,folder.path_join(name))
	var entry = descriptor.duplicate(true)
	entry.file = name
	var catalog = {"runtime":Boot.RUNTIME,"base_version":"0.4.0","version":"0.4.1","packs":[entry]}
	check(Boot.valid_catalog(catalog,"0.4.0",folder),"Boot accepts a complete verified catalog")
	check(not Boot.valid_catalog(catalog,"0.4.1",folder),"New full exe cannot load stale overlays from an old base")
	var invalid = catalog.duplicate(true)
	invalid.packs[0].file = "../"+name
	check(not Boot.valid_catalog(invalid,"0.4.0",folder),"Overlay paths cannot leave the update directory")
	invalid = catalog.duplicate(true)
	invalid.packs[0]["from"] = "0.3.9"
	check(not Boot.valid_catalog(invalid,"0.4.0",folder),"Broken installed chain is rejected before mounting")
	invalid = catalog.duplicate(true)
	invalid.packs[0].to = "0.3.9"
	invalid.version = "0.3.9"
	check(not Boot.valid_catalog(invalid,"0.4.0",folder),"An installed catalog cannot downgrade the game")
	f = FileAccess.open(folder.path_join(name),FileAccess.WRITE)
	f.store_buffer("GDPC".repeat(99).to_utf8_buffer())
	f.close()
	check(not Boot.valid_catalog(catalog,"0.4.0",folder),"Truncated pack prevents activation")
	DirAccess.remove_absolute(folder.path_join(name))
	DirAccess.remove_absolute(folder)
	print("PATCH CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
