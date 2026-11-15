extends SceneTree
func _initialize():
	var args = OS.get_cmdline_user_args()
	if args.size()!=2:
		quit(1)
		return
	var index = JSON.parse_string(FileAccess.get_file_as_string(args[1]))
	if not index is Dictionary or not ProjectSettings.load_resource_pack(args[0],true):
		quit(1)
		return
	for path in index.files:
		if FileAccess.get_sha256("res://"+path)!=index.files[path]:
			push_error("Full installer and content baseline differ: "+path)
			quit(1)
			return
	print("FULL EXE / CONTENT BASELINE: all resource hashes match")
	quit()
