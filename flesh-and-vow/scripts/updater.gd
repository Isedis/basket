extends CanvasLayer

const VERSION = "0.6.11"
const PATCH_RUNTIME = "godot-4.6.3-patch-1"
const FEED = "https://github.com/Isedis/basket/releases/download/flesh-latest/update.json"
const ASSET_PREFIX = "https://github.com/Isedis/basket/releases/download/"
const LIMIT = 250 * 1024 * 1024
var http: HTTPRequest
var overlay: ColorRect
var status_label: Label
var detail: Label
var install: Button
var close_button: Button
var release: Dictionary = {}
var state = "idle"
var pending_file = ""
var config_path = "user://updater-config.json"
var test_feed = ""
var update_plan: Dictionary = {}
var staged_packs: Array = []
var download_index = 0
var downloaded_bytes = 0

func _ready():
	layer = 20
	http = HTTPRequest.new()
	http.timeout = 30
	http.max_redirects = 5
	add_child(http)
	http.request_completed.connect(_completed)
	build_ui()

func build_ui():
	overlay = ColorRect.new()
	overlay.color = Color(0.02,0.02,0.04,0.94)
	overlay.size = Vector2(960,540)
	add_child(overlay)
	var panel = PanelContainer.new()
	panel.position = Vector2(180,115)
	panel.size = Vector2(600,310)
	var style = StyleBoxFlat.new()
	style.bg_color = Color("17151f")
	style.border_color = Color("b99a70")
	style.set_border_width_all(1)
	style.content_margin_left = 24
	style.content_margin_right = 24
	style.content_margin_top = 24
	style.content_margin_bottom = 24
	panel.add_theme_stylebox_override("panel",style)
	overlay.add_child(panel)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation",16)
	panel.add_child(box)
	var heading = Label.new()
	heading.text = "ОБНОВЛЕНИЕ · ПЛОТЬ И ОБЕТ"
	heading.add_theme_font_size_override("font_size",21)
	heading.add_theme_color_override("font_color",Color("d0ad7d"))
	box.add_child(heading)
	status_label = Label.new()
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.custom_minimum_size = Vector2(540,48)
	box.add_child(status_label)
	detail = Label.new()
	detail.add_theme_font_size_override("font_size",13)
	detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail.custom_minimum_size = Vector2(540,64)
	box.add_child(detail)
	var buttons = HBoxContainer.new()
	buttons.add_theme_constant_override("separation",16)
	box.add_child(buttons)
	install = Button.new()
	install.text = "Установить и перезапустить"
	install.custom_minimum_size = Vector2(315,40)
	install.pressed.connect(download_release)
	buttons.add_child(install)
	close_button = Button.new()
	close_button.text = "Закрыть"
	close_button.custom_minimum_size = Vector2(180,40)
	close_button.pressed.connect(close)
	buttons.add_child(close_button)
	overlay.hide()

func is_open() -> bool:
	return overlay != null and overlay.visible

func open():
	overlay.show()
	if state in ["checking","downloading","installing"]: return
	release.clear()
	install.disabled = true
	status_label.text = "Проверяем новые версии…"
	detail.text = "Установлена версия %s. Сохранения останутся на месте." % VERSION
	state = "checking"
	http.download_file = ""
	http.body_size_limit = 262144
	http.timeout = 30
	var err = http.request(FEED if test_feed.is_empty() else test_feed,["User-Agent: FleshAndVow/"+VERSION,"Cache-Control: no-cache"])
	if err != OK: fail("Не удалось начать проверку. Попробуй позже.")

func close():
	if state == "installing": return
	http.cancel_request()
	cleanup()
	state = "idle"
	overlay.hide()

static func version_parts(value: String) -> Array:
	var parts = value.split(".")
	if parts.size()!=3: return []
	var numbers: Array = []
	for p in parts:
		if not p.is_valid_int() or p.begins_with("-") or str(int(p))!=p: return []
		numbers.append(int(p))
	return numbers

static func newer(a: String, b: String) -> bool:
	var first = version_parts(a)
	var second = version_parts(b)
	if first.is_empty() or second.is_empty(): return false
	for i in range(3):
		if first[i]!=second[i]: return first[i]>second[i]
	return false

static func valid_manifest(data) -> bool:
	if not data is Dictionary: return false
	for key in ["version","url","sha256","size"]:
		if not data.has(key): return false
	if not data.version is String or version_parts(data.version).is_empty(): return false
	if not data.url is String or not data.url.begins_with(ASSET_PREFIX): return false
	if not data.url.ends_with("/FleshAndVow.exe") or "?" in data.url or "#" in data.url: return false
	if not data.sha256 is String or data.sha256.length()!=64: return false
	for c in data.sha256.to_lower():
		if c not in "0123456789abcdef": return false
	if not (data.size is int or data.size is float): return false
	if data.size!=int(data.size) or data.size<=1024 or data.size>LIMIT: return false
	if data.has("runtime"):
		if not data.runtime is String or data.get("format")!=2 or not valid_pack(data.get("snapshot")): return false
		if data.has("bootstrap"):
			if not data.bootstrap is String: return false
			var pieces = data.bootstrap.split(":")
			if pieces.size()!=2 or not preload("res://scripts/patch_boot.gd").hash_ok(pieces[0]) or not preload("res://scripts/patch_boot.gd").hash_ok(pieces[1]): return false
		if not data.get("patches") is Array or data.patches.size()>128: return false
		for patch in data.patches:
			if not valid_pack(patch) or not patch.get("from") is String or not patch.get("to") is String: return false
			if version_parts(patch.from).is_empty() or version_parts(patch.to).is_empty() or not newer(patch.to,patch.from): return false
	return true

static func valid_pack(data) -> bool:
	if not data is Dictionary: return false
	if not data.get("url") is String or not data.url.begins_with(ASSET_PREFIX) or not data.url.ends_with(".pck"): return false
	if "?" in data.url or "#" in data.url: return false
	if not preload("res://scripts/patch_boot.gd").hash_ok(data.get("sha256")): return false
	if not data.get("size") is int and not data.get("size") is float: return false
	return data.size==int(data.size) and data.size>=80 and data.size<=LIMIT

static func plan_update(data: Dictionary, current: String, runtime: String = PATCH_RUNTIME, force_snapshot: bool = false, bootstrap: String = "") -> Dictionary:
	var full = {"kind":"full","files":[data],"total":int(data.size)}
	if data.get("runtime","")!=runtime or not data.has("snapshot"): return full
	if data.has("bootstrap") and data.bootstrap!=bootstrap: return full
	var snapshot: Dictionary = data.snapshot.duplicate(true)
	snapshot["from"] = current
	snapshot["to"] = data.version
	var result = {"kind":"snapshot","files":[snapshot],"total":int(snapshot.size)}
	if force_snapshot: return result
	var version = current
	var route: Array = []
	var total = 0
	for i in range(128):
		if version==data.version: break
		var found = false
		for edge in data.get("patches",[]):
			if edge.from==version and not newer(edge.to,data.version):
				route.append(edge)
				total += int(edge.size)
				version = edge.to
				found = true
				break
		if not found: break
	if version==data.version and not route.is_empty() and total<int(snapshot.size):
		result = {"kind":"patch","files":route,"total":total}
	return result

func _completed(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray):
	if result!=HTTPRequest.RESULT_SUCCESS or code!=200:
		fail("Не удалось получить обновление. Проверь интернет и попробуй позже. (HTTP %d)"%code)
		return
	if state == "checking":
		var parser = JSON.new()
		var parsed = parser.data if parser.parse(body.get_string_from_utf8())==OK else null
		if not valid_manifest(parsed):
			fail("Сервер вернул некорректные сведения о версии. Файлы игры не изменены.")
			return
		if not newer(parsed.version,VERSION):
			state = "current"
			status_label.text = "У тебя последняя версия · "+VERSION
			detail.text = "Новые версии появятся здесь после публикации."
			return
		release = parsed
		var recovery = not str(ProjectSettings.get_meta("flesh_patch_warning","")).is_empty()
		var installed: Dictionary = ProjectSettings.get_meta("flesh_patch_state",{})
		update_plan = plan_update(release,VERSION,PATCH_RUNTIME,recovery,str(installed.get("bootstrap","")))
		if update_plan.kind=="patch" and installed.get("packs",[]).size()+update_plan.files.size()>128:
			update_plan = plan_update(release,VERSION,PATCH_RUNTIME,true,str(installed.get("bootstrap","")))
		state = "available"
		status_label.text = "Доступна версия %s · %s"%[release.version,format_size(update_plan.total)]
		detail.text = str(release.get("notes","Исправления и улучшения." )).left(240)+"\nИгра закроется и запустится после установки."
		if update_plan.kind!="full": detail.text += "\nСкачиваются файлы игры. Движок остаётся на месте."
		else: detail.text += "\nДля этой версии требуется обновление движка или установщика."
		install.disabled = OS.get_name()!="Windows" or OS.has_feature("editor")
		if install.disabled: detail.text += "\nАвтоустановка доступна в готовой Windows-сборке."
	elif state == "downloading":
		var item: Dictionary = update_plan.files[download_index]
		if not verify_payload(pending_file,item,update_plan.kind!="full"):
			fail("Проверка файла не пройдена. Обновление отменено; текущая игра сохранена.")
			return
		if update_plan.kind=="full": launch_installer()
		else:
			var staged = item.duplicate(true)
			staged.source = pending_file
			staged_packs.append(staged)
			downloaded_bytes += int(item.size)
			download_index += 1
			pending_file = ""
			download_next()

static func verify_payload(path: String, manifest: Dictionary, pack: bool = false) -> bool:
	var file = FileAccess.open(path,FileAccess.READ)
	if not file: return false
	var magic = PackedByteArray([71,68,80,67]) if pack else PackedByteArray([77,90])
	var valid = file.get_length()==int(manifest.size) and file.get_buffer(magic.size())==magic
	file.close()
	return valid and FileAccess.get_sha256(path).to_lower()==str(manifest.sha256).to_lower()

func download_release():
	if state!="available" or OS.get_name()!="Windows" or OS.has_feature("editor"): return
	var target = OS.get_executable_path()
	# Probe the installation folder before a long download. Never request administrator rights.
	var probe = FileAccess.open(target+".write-test",FileAccess.WRITE)
	if not probe:
		fail("Нет доступа к папке игры. Перенеси её в доступную папку, например «Документы».")
		return
	probe.close()
	DirAccess.remove_absolute(target+".write-test")
	state = "downloading"
	download_index = 0
	downloaded_bytes = 0
	staged_packs.clear()
	install.disabled = true
	status_label.text = "Скачиваем версию "+release.version+"…"
	detail.text = "Игру пока можно оставить открытой. «Закрыть» отменит скачивание."
	download_next()

func download_next():
	if download_index>=update_plan.files.size():
		launch_installer()
		return
	var item: Dictionary = update_plan.files[download_index]
	var suffix = ".exe" if update_plan.kind=="full" else ".pck"
	pending_file = OS.get_cache_dir().path_join("flesh-update-%s-%d%s"%[str(OS.get_process_id()),download_index,suffix])
	http.download_file = pending_file
	http.body_size_limit = int(item.size)
	http.timeout = 300
	var err = http.request(item.url,["User-Agent: FleshAndVow/"+VERSION])
	if err!=OK: fail("Не удалось начать загрузку.")

static func format_size(bytes: int) -> String:
	if bytes<1048576: return "%.0f КБ"%(bytes/1024.0)
	return "%.1f МБ"%(bytes/1048576.0)

func _process(_dt):
	if state=="downloading":
		status_label.text = "Скачиваем версию %s · %s / %s"%[release.version,format_size(downloaded_bytes+http.get_downloaded_bytes()),format_size(update_plan.total)]

func launch_installer():
	var script_path = OS.get_cache_dir().path_join("flesh-updater-"+str(OS.get_process_id())+".ps1")
	var is_patch = update_plan.kind!="full"
	var source = FileAccess.get_file_as_string("res://scripts/install_patch.ps1" if is_patch else "res://scripts/install_update.ps1")
	if source.is_empty():
		fail("Не найден установщик. Текущая версия осталась на месте.")
		return
	var script = FileAccess.open(script_path,FileAccess.WRITE)
	if not script:
		fail("Не удалось подготовить установщик.")
		return
	script.store_string(source)
	script.close()
	var payload = {"pid":OS.get_process_id(),"source":pending_file,"target":OS.get_executable_path(),"sha256":release.sha256,"size":int(release.size)}
	if is_patch:
		var installed: Dictionary = ProjectSettings.get_meta("flesh_patch_state",{"base_version":VERSION})
		payload = {"pid":OS.get_process_id(),"exe":OS.get_executable_path(),"runtime":PATCH_RUNTIME,"base_version":installed.base_version,"current_version":VERSION,"version":release.version,"replace":update_plan.kind=="snapshot","repair":not str(ProjectSettings.get_meta("flesh_patch_warning","")).is_empty(),"packs":staged_packs}
	# Base64-encoded JSON prevents paths and quotes being interpreted as PowerShell code.
	var encoded = Marshalls.utf8_to_base64(JSON.stringify(payload))
	var powershell = OS.get_environment("SystemRoot").path_join("System32/WindowsPowerShell/v1.0/powershell.exe")
	var pid = OS.create_process(powershell,["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script_path,"-Payload",encoded],false)
	if pid<0:
		fail("Не удалось запустить установщик. Файлы игры не изменены.")
		return
	state = "installing"
	get_tree().quit()

func cleanup():
	if not pending_file.is_empty() and FileAccess.file_exists(pending_file):
		DirAccess.remove_absolute(pending_file)
	pending_file = ""
	for entry in staged_packs:
		if FileAccess.file_exists(entry.source): DirAccess.remove_absolute(entry.source)
	staged_packs.clear()

func fail(reason: String):
	state = "error"
	cleanup()
	status_label.text = reason
	detail.text = "Установлена версия "+VERSION+". Повторить проверку можно, открыв это окно снова."
	install.disabled = true
