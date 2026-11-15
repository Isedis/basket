extends Node
## This scene must not preload game scripts: packs are mounted before the game loads.
const RUNTIME = "godot-4.6.3-patch-1"
const MAX_PACKS = 128
var storage_root = ""

static func hash_ok(value) -> bool:
	if not value is String or value.length()!=64: return false
	for c in value:
		if c not in "0123456789abcdef": return false
	return true

static func valid_catalog(data, base: String, folder: String) -> bool:
	if not data is Dictionary or data.get("runtime")!=RUNTIME or data.get("base_version")!=base: return false
	if not data.get("version") is String or not data.get("packs") is Array: return false
	if data.packs.is_empty() or data.packs.size()>MAX_PACKS: return false
	var previous = base
	for entry in data.packs:
		if not entry is Dictionary or not hash_ok(entry.get("sha256")): return false
		if entry.get("file")!=entry.sha256+".pck" or entry.get("from")!=previous or not entry.get("to") is String: return false
		if not version_newer(entry.to,previous) or not entry.get("size") is float and not entry.get("size") is int: return false
		if entry.size!=int(entry.size) or entry.size<80 or entry.size>250*1024*1024: return false
		var path = folder.path_join(entry.file)
		var f = FileAccess.open(path,FileAccess.READ)
		if not f: return false
		var valid = f.get_length()==int(entry.size) and f.get_buffer(4)==PackedByteArray([71,68,80,67])
		f.close()
		if not valid or FileAccess.get_sha256(path)!=entry.sha256: return false
		previous = entry.to
	return previous==data.version

static func version_newer(a: String, b: String) -> bool:
	var first = a.split(".")
	var second = b.split(".")
	if first.size()!=3 or second.size()!=3: return false
	for p in first+second:
		if not p.is_valid_int() or int(p)<0 or str(int(p))!=p: return false
	for i in range(3):
		if int(first[i])!=int(second[i]): return int(first[i])>int(second[i])
	return false

static func read_json(path: String):
	if not FileAccess.file_exists(path): return null
	var f = FileAccess.open(path,FileAccess.READ)
	if not f or f.get_length()>262144: return null
	var parser = JSON.new()
	return parser.data if parser.parse(f.get_as_text())==OK else null

func _ready(): call_deferred("start")

func start():
	var build = read_json("res://build.json")
	if not build is Dictionary or not build.get("version") is String:
		push_error("Missing embedded build version")
		get_tree().quit(1)
		return
	var base: String = build.version
	var bootstrap = FileAccess.get_sha256("res://project.binary")+":"+FileAccess.get_sha256("res://scripts/patch_boot.gdc") if FileAccess.file_exists("res://project.binary") else "editor"
	if storage_root.is_empty(): storage_root = OS.get_executable_path().get_base_dir().path_join(".flesh-updates")
	var state = {"runtime":RUNTIME,"base_version":base,"version":base,"packs":[]}
	var warning = "Обновление пропущено: игра запущена из встроенной рабочей версии." if "--flesh-safe-base" in OS.get_cmdline_user_args() else ""
	if "--flesh-safe-base" not in OS.get_cmdline_user_args():
		var active_path = storage_root.path_join("active.json")
		var active = read_json(active_path)
		if FileAccess.file_exists(active_path) and (not active is Dictionary or not active.get("base_version") is String or active.get("base_version")==base):
			if valid_catalog(active,base,storage_root): state = active
			else:
				var previous = read_json(storage_root.path_join("active.previous.json"))
				if valid_catalog(previous,base,storage_root): state = previous
				warning = "Повреждённое обновление пропущено. Загружена рабочая версия."
	for entry in state.packs:
		if not ProjectSettings.load_resource_pack(storage_root.path_join(entry.file),true):
			# A partially mounted chain cannot be unloaded. Restart cleanly from the embedded base.
			OS.create_process(OS.get_executable_path(),["--","--flesh-safe-base"])
			get_tree().quit()
			return
	state["bootstrap"] = bootstrap
	ProjectSettings.set_meta("flesh_patch_state",state)
	ProjectSettings.set_meta("flesh_patch_warning",warning)
	if not warning.is_empty() and DisplayServer.get_name()!="headless":
		OS.alert(warning+" Открой «Проверить обновления», чтобы восстановить файлы.","Плоть и Обет")
	get_tree().change_scene_to_packed(load("res://main.tscn"))
