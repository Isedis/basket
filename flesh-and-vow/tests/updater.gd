extends SceneTree
const Updater = preload("res://scripts/updater.gd")
var failures = 0
var checks = 0
func check(ok: bool, label: String):
	checks += 1
	if not ok:
		failures += 1
		push_error(label)
func _initialize(): call_deferred("run")
func run():
	for pair in [["0.2.1","0.2.0"],["0.10.0","0.9.0"],["1.0.0","0.99.99"]]:
		check(Updater.newer(pair[0],pair[1]),"Newer version "+pair[0])
	for version in ["0.1.0","0.2.0","banana","1.2","1.2.3.4","-1.2.3","01.2.3"]:
		check(not Updater.newer(version,"0.2.0"),"Reject downgrade / invalid version "+version)
	var path = "user://test_update_payload.exe"
	var f = FileAccess.open(path,FileAccess.WRITE)
	f.store_buffer(PackedByteArray([77,90]))
	f.store_buffer("fixture".repeat(500).to_utf8_buffer())
	f.close()
	var future_version = str(Updater.version_parts(Updater.VERSION)[0]+1)+".0.0"
	var good = {"version":future_version,"url":Updater.ASSET_PREFIX+"flesh-v0.2.1/FleshAndVow.exe","sha256":FileAccess.get_sha256(path),"size":FileAccess.open(path,FileAccess.READ).get_length()}
	check(Updater.valid_manifest(good),"Valid manifest")
	check(Updater.verify_payload(path,good),"Verified payload")
	for patch in [{"url":"http://github.com/Isedis/basket/releases/download/a/FleshAndVow.exe"},{"url":"https://evil.test/payload.exe"},{"sha256":"bad"},{"sha256":"z".repeat(64)},{"size":Updater.LIMIT+1},{"size":2.5},{"size":-1},{"version":"v0.3"}]:
		var bad = good.duplicate(true)
		bad.merge(patch,true)
		check(not Updater.valid_manifest(bad),"Reject malformed manifest "+str(patch))
	var bad_hash = good.duplicate(true)
	bad_hash.sha256 = "0".repeat(64)
	check(not Updater.verify_payload(path,bad_hash),"Reject wrong hash")
	bad_hash = good.duplicate(true)
	bad_hash.size += 1
	check(not Updater.verify_payload(path,bad_hash),"Reject wrong size")
	check(not Updater.verify_payload(path+"missing",good),"Reject missing file")
	var ui = Updater.new()
	root.add_child(ui)
	await process_frame
	ui.overlay.show()
	ui.state = "checking"
	ui._completed(0,200,PackedStringArray(),JSON.stringify(good).to_utf8_buffer())
	check(ui.state=="available","New version enables offer")
	good.version = Updater.VERSION
	ui.state = "checking"
	ui._completed(0,200,PackedStringArray(),JSON.stringify(good).to_utf8_buffer())
	check(ui.state=="current","Current version result")
	ui.state = "checking"
	ui._completed(0,404,PackedStringArray(),PackedByteArray())
	check(ui.state=="error","HTTP error keeps app alive")
	ui.state = "checking"
	ui._completed(0,200,PackedStringArray(),"<html>bad</html>".to_utf8_buffer())
	check(ui.state=="error","Reject HTML error page")
	ui.close()
	check(not ui.is_open() and ui.state=="idle","Close cancels operation")
	DirAccess.remove_absolute(path)
	print("UPDATER CHECKS: %d | FAILURES: %d"%[checks,failures])
	quit(1 if failures else 0)
