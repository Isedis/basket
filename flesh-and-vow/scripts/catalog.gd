extends RefCounted

const FLOORS = [
	{"name":"I · ЗАМОК БЕЗ ИМЕНИ", "short":"Замок", "color":"555064", "boss":"Колокольный палач", "thought":"Тот, кто создал цепь, тоже привязан к ней."},
	{"name":"II · АНАТОМИЯ ВЕРЫ", "short":"Лаборатория", "color":"426263", "boss":"Матерь швов", "thought":"Если заменить всё тело — кто продолжит страдать?"},
	{"name":"III · САД РАЗЛОЖЕНИЯ", "short":"Катакомбы", "color":"566148", "boss":"Гнилой наследник", "thought":"Всё живое питается тем, что перестало жить."},
	{"name":"IV · ПУСТОЙ СОБОР", "short":"Собор", "color":"66533e", "boss":"Святой без лица", "thought":"Свобода начинается там, где больше некому повиноваться."}
]
# Descriptions deliberately hint at effects. Mechanics live in game.gd.
const ITEMS = [
	{"id":"cleaver", "name":"Зуб палача", "hint":"Даже воздух помнит лезвие.", "color":"c2b7a0"},
	{"id":"ember", "name":"Уголь исповедника", "hint":"Слова кончились. Жар остался.", "color":"ed9254"},
	{"id":"frost", "name":"Холодный шов", "hint":"Кровь забывает, куда течь.", "color":"8bcbd1"},
	{"id":"leech", "name":"Голодная нить", "hint":"Чужой конец становится твоим началом.", "color":"bb6174"},
	{"id":"thorns", "name":"Венец виновного", "hint":"Прикосновение требует расплаты.", "color":"c7b075"},
	{"id":"echo", "name":"Вторая воля", "hint":"Твой удар больше не одинок.", "color":"aa92ce"},
	{"id":"rot", "name":"Цветок под кожей", "hint":"Красота прорастает изнутри.", "color":"91b46a"},
	{"id":"blink", "name":"Пустое сухожилие", "hint":"Между двумя шагами нет тебя.", "color":"8ca9cd"},
	{"id":"orbit", "name":"Осколок клятвы", "hint":"Обещания ходят кругами.", "color":"e0c69a"},
	{"id":"rage", "name":"Живая рана", "hint":"Боль помнит, как стать силой.", "color":"dd6270"},
	{"id":"heavy", "name":"Кость великана", "hint":"Земля услышит каждый взмах.", "color":"d2c8ad"},
	{"id":"haste", "name":"Пульс беглеца", "hint":"Сердце не желает ждать.", "color":"e9a3a4"},
	{"id":"sight", "name":"Глаз в стене", "hint":"Камень тоже умеет лгать.", "color":"a8c7a2"},
	{"id":"bloodwave", "name":"Письмо кровью", "hint":"У каждой раны есть продолжение.", "color":"c9465d"},
	{"id":"vessel", "name":"Чаша плоти", "hint":"Три победы наполнят пустоту. [Пробел]", "color":"d4bd88"},
	{"id":"storm", "name":"Колокол грозы", "hint":"Ответит всем, кто рядом. [Пробел]", "color":"b8b2e4"},
	{"id":"pact", "name":"Нечестный договор", "hint":"Чем меньше осталось, тем больше дано.", "color":"e15b71", "unlock":"boss1"},
	{"id":"martyr", "name":"Прах мученика", "hint":"Свет не просит прощения.", "color":"e9d89d", "unlock":"boss2"},
	{"id":"harvest", "name":"Серп забвения", "hint":"Каждый конец зовёт следующий.", "color":"a1c77c", "unlock":"boss3"},
	{"id":"void", "name":"Сердце пустоты", "hint":"Ничто не осталось без ответа.", "color":"a393d3", "unlock":"victory"},
]

static func item(id: String) -> Dictionary:
	for entry in ITEMS:
		if entry.id == id:
			return entry
	return ITEMS[0]

static func pool(unlocks: Array) -> Array:
	var result: Array = []
	for entry in ITEMS:
		if not entry.has("unlock") or entry.unlock in unlocks:
			result.append(entry.id)
	return result
