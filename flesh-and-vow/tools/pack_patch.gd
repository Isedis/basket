extends SceneTree
func _initialize():
	var args = OS.get_cmdline_user_args()
	if args.size()!=2:
		push_error("Expected plan.json output.pck")
		quit(1)
		return
	var plan = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var pack = PCKPacker.new()
	if pack.pck_start(args[1])!=OK:
		quit(1)
		return
	for entry in plan.files:
		if pack.add_file("res://"+entry.path,entry.source)!=OK:
			quit(1)
			return
	for path in plan.removals:
		if pack.add_file_removal("res://"+path)!=OK:
			quit(1)
			return
	if pack.flush()!=OK:
		quit(1)
		return
	quit()
