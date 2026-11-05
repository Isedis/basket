/* Explainable checks of brandbook instructions. No image/model analysis. */
function parseBrandHex(value) {
  const match=String(value).trim().match(/^#([a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/i);
  if(!match)return null;
  let digits=match[1];if(digits.length<=4)digits=[...digits].map(c=>c+c).join('');
  const rgb=[0,2,4].map(i=>parseInt(digits.slice(i,i+2),16));
  const alpha=digits.length===8?parseInt(digits.slice(6),16):255;
  return {hex:'#'+digits.slice(0,6).toUpperCase()+(alpha===255?'':digits.slice(6).toUpperCase()),rgb,alpha};
}
function brandContrast(a,b) {
  const left=typeof a==='string'?parseBrandHex(a):a;
  const right=typeof b==='string'?parseBrandHex(b):b;
  if(!left || !right || left.alpha!==255 || right.alpha!==255)return null;
  const luminance=c=>c.rgb.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const l=luminance(left),r=luminance(right);
  return (Math.max(l,r)+0.05)/(Math.min(l,r)+0.05);
}
function formatBrandRatio(value){return (Math.floor(value*100)/100).toFixed(2);}
function reviewSignature(state){return JSON.stringify({brand:state.brand,references:state.references});}

function assessBrandbook(state,options={}) {
  const brand=state.brand||{};
  const refs=state.references||[];
  const fields=Object.fromEntries(['direction','palette','fonts','avoid'].map(k=>[k,String(brand[k]||'').slice(0,65536)]));
  const checks=[],findings=[],pairs=[],colors=new Map();
  const add=(id,severity,title,detail,suggestion,field,acceptance)=>findings.push({id,severity,title,detail,suggestion,field,acceptance:acceptance||suggestion});
  const check=(id,label,status)=>checks.push({id,label,status});
  const unknown=/назначение не|роль не|не утвержден|объявлен в файлах|приблизительно из изображения|не задан|не выбран|не определ|пока не|todo|tbd/iu;
  const textRole=/(?:^|[^\p{L}\p{N}_])(текст(?:а|ом)?|надпис[ьи]|подпис[ьи]|заголов[\p{L}]*|text|foreground|font[ _]color)(?:$|[^\p{L}\p{N}_])/iu;
  const bgRole=/(?:^|[^\p{L}\p{N}_])(фон(?:а|е)?|background|bg)(?:$|[^\p{L}\p{N}_])/iu;
  const inactiveRole=/disabled|inactive|неактивн|отключ[её]н/iu;
  const invalid=[];let tokens=0,truncated=false;
  for(const [index,line] of fields.palette.split('\n').entries()) {
    const entries=[];
    for(const match of line.matchAll(/#[a-zA-Z0-9]+/g)) {
      if(match.index>0 && /[\p{L}\p{N}_/\\]/u.test(line[match.index-1]))continue;
      if(/^\.(?:tres|tscn|gd|svg|png|jpe?g|webp)\b/i.test(line.slice(match.index+match[0].length)))continue;
      if(++tokens>256){truncated=true;break;}
      const color=parseBrandHex(match[0]);
      if(!color){invalid.push(match[0]);continue;}
      const entry={...color,line:index+1,offset:match.index,end:match.index+match[0].length,description:line};
      entries.push(entry);
      const description=line.replace(/#[a-zA-Z0-9]+/g,'').replace(/(?:res:\/\/)?\S+\.(?:tres|tscn|gd|png|jpe?g|webp|svg)(?::\d+)?/gi,'').replace(/[\s:;—–\-(),.\d]/g,'');
      const named=!unknown.test(line) && /\p{L}{2}/u.test(description);
      if(!colors.has(color.hex))colors.set(color.hex,{...color,named:false,roles:[],largeText:false,regularText:false});
      const saved=colors.get(color.hex);saved.named ||= named;
      if(!unknown.test(line)) {
        if(textRole.test(line)) {
          if(!saved.roles.includes('text'))saved.roles.push('text');
          if(/крупн[\p{L}]*\s+текст|large\s+text/iu.test(line))saved.largeText=true;else saved.regularText=true;
        }
        if(bgRole.test(line) && !saved.roles.includes('background'))saved.roles.push('background');
      }
    }
    // Only infer pairs that the user explicitly wrote as text-on-background.
    if(entries.length===2 && textRole.test(line) && /(?:\sна\s|\son\s)/iu.test(line.slice(entries[0].end,entries[1].offset)) && !unknown.test(line)) {
      pairs.push({foreground:entries[0].hex,background:entries[1].hex,label:line.slice(0,entries[0].offset).replace(/[:\s]+$/,'')||'Текстовая пара',largeText:/крупн[\p{L}]*\s+текст|large\s+text/iu.test(line),excluded:inactiveRole.test(line),line:index+1});
    }
    if(truncated)break;
  }
  const palette=[...colors.values()];
  if(!pairs.length) {
    const texts=palette.filter(c=>c.roles.includes('text')&&!c.roles.includes('background'));
    const backgrounds=palette.filter(c=>c.roles.includes('background')&&!c.roles.includes('text'));
    // A color intentionally used for both roles still needs the 1:1 check.
    const both=palette.filter(c=>c.roles.includes('text')&&c.roles.includes('background'));
    if(texts.length===1 && backgrounds.length===1)pairs.push({foreground:texts[0].hex,background:backgrounds[0].hex,label:'Текст и фон по указанным ролям',largeText:texts[0].largeText&&!texts[0].regularText});
    else if(!texts.length && !backgrounds.length && both.length===1)pairs.push({foreground:both[0].hex,background:both[0].hex,label:'Один цвет для текста и фона'});
  }
  if(pairs.length>20){pairs.length=20;truncated=true;}

  const directionPending=!fields.direction.trim() || /художественное направление и настроение пока не установлены/iu.test(fields.direction) || /^(?:не знаю|пока не знаю|не определ[её]но|не задано|пока нет|todo|tbd)[\s.!]*$/iu.test(fields.direction.trim()) || /^(?:сделать\s+)?(?:красиво|стильно|современно|атмосферно)[\s!.,]*$/iu.test(fields.direction.trim());
  check('direction','Описано визуальное направление',directionPending?'needs_info':'pass');
  if(directionPending)add('direction-missing','warning','Визуальное направление не определено',fields.direction.trim()?'Есть черновик или общее пожелание, но по нему агенту придётся выбирать стиль.':'Поле направления пустое.','Опишите настроение, формы, материалы и плотность деталей. Например: «матовые панели, тонкая обводка, сдержанные скругления, один акцент на экране».','direction','Подготовить конкретное описание направления и показать его на одном экране; окончательный вариант утверждает пользователь.');

  check('palette','Палитра содержит корректные HEX-цвета',palette.length && !invalid.length && !truncated?'pass':invalid.length?'issue':'needs_info');
  if(!palette.length)add('palette-missing','warning','Нет пригодной палитры','Корректные HEX-цвета не найдены.','Укажите цвета в формате #RRGGBB и подпишите назначение каждого.','palette');
  if(invalid.length)add('palette-invalid','error','Есть некорректные коды цвета','Не распознаны: '+[...new Set(invalid)].slice(0,8).join(', '),'Используйте #RGB, #RGBA, #RRGGBB или #RRGGBBAA. Исправьте длину кода и символы.','palette');
  const unnamed=palette.filter(c=>!c.named);
  check('roles','У цветов указано назначение',palette.length && !unnamed.length?'pass':'needs_info');
  if(unnamed.length)add('palette-roles','warning','Цвета есть, но неясно, где их применять','Без назначения: '+unnamed.slice(0,8).map(c=>c.hex).join(', '),'Подпишите фон, основной текст, панели, акцент и состояния. Автоматически найденный цвет не становится основным.','palette');
  if(palette.length>12)add('palette-many','note','Палитру стоит разделить на группы',`Найдено уникальных цветов: ${palette.length}. Большое число само по себе не является ошибкой.`,'Отделите интерфейс от цветов ассетов; выделите основные цвета и допустимые оттенки.','palette');

  const evaluated=pairs.map(pair=>{
    const ratio=brandContrast(pair.foreground,pair.background);
    const target=pair.largeText?3:4.5;
    const candidates=[...palette.map(c=>c.hex),'#FFFFFF','#000000'].filter((hex,i,array)=>array.indexOf(hex)===i).map(hex=>({hex,ratio:brandContrast(hex,pair.background),existing:palette.some(c=>c.hex===hex)})).filter(c=>c.ratio!==null && c.ratio>=target).sort((a,b)=>Number(b.existing)-Number(a.existing)||b.ratio-a.ratio);
    return {...pair,ratio,target,status:pair.excluded?'excluded':ratio===null?'unknown':ratio<target?'issue':'pass',proposal:!pair.excluded && ratio!==null && ratio<target?candidates[0]||null:null};
  });
  const tested=evaluated.filter(p=>!p.excluded);
  check('contrast','Проверены объявленные пары текста и фона',tested.length && tested.every(p=>p.status==='pass') && !truncated?'pass':tested.some(p=>p.status==='issue')?'issue':'needs_info');
  if(!tested.length)add('contrast-unspecified','warning','Пока нельзя проверить читаемость',evaluated.length?'Указаны только неактивные состояния. Пары обычного текста не заданы.':'Однозначные пары текста и фона не указаны. Случайные сочетания палитры не проверялись.','Добавьте строку «Основной текст: #FFFFFF на #151E21» или по одному явно подписанному цвету текста и фона.','palette');
  for(const pair of evaluated) {
    const id='contrast-'+pair.foreground.slice(1)+'-'+pair.background.slice(1);
    if(pair.excluded){add(id+'-inactive','note','Неактивное состояние не оценивается как обычный текст',`${pair.foreground} на ${pair.background} явно помечено как disabled / неактивное.`,'Проверьте, что неактивность понятна игроку. Низкий контраст этого состояния сам по себе не объявляется ошибкой.','palette');continue;}
    if(pair.ratio===null)add(id,'warning','Полупрозрачную пару нельзя оценить без подложки',`${pair.foreground} на ${pair.background}: итоговый цвет после наложения не задан.`,'Укажите непрозрачные итоговые цвета или проверьте сочетание на фактическом фоне в игре.','palette');
    else if(pair.ratio<pair.target)add(id,pair.ratio<3?'error':'warning','Контраст ниже выбранного ориентира',`${pair.foreground} на ${pair.background}: ${formatBrandRatio(pair.ratio)}:1 при ориентире ${pair.target}:1 ${pair.largeText?'для явно помеченного крупного':'для обычного'} текста.`,(pair.proposal?`Вариант для обсуждения: ${pair.proposal.hex} на том же фоне даёт ${formatBrandRatio(pair.proposal.ratio)}:1. `:'')+'Для крупного текста можно явно указать «Крупный текст: … на …» (3:1); реальный размер и отображение проверьте в Godot.','palette',`Предложить читаемую пару с расчётным контрастом не ниже ${pair.target}:1; изменение палитры и проверку в Godot подтверждает пользователь.`);
  }

  const fontPending=/не выбран|не определ|пока не|пока отсутств|шрифты? не найден/iu.test(fields.fonts);
  const withoutSizes=fields.fonts.replace(/\S+\.(?:tscn|tres|gd)(?::\d+)?/gi,'').replace(/\d+(?:[.,]\d+)?\s*(?:px|пкс|пиксел[\p{L}]*)/giu,'').replace(/(?:шрифт[\p{L}]*|семейство|font(?: family)?)\s*[:=]/giu,'').replace(/default_font_size|font_size|заголов[\p{L}]*|основн[\p{L}]*|текст[\p{L}]*|подпис[\p{L}]*|размер[\p{L}]*|весь интерфейс|единый размер|heading|title|body|all ui|all text/giu,'').replace(/[\s\d:;—–\-(),.]/g,'').trim();
  const fontPresent=!!withoutSizes && !fontPending;
  check('fonts','Названы шрифты',fontPresent?'pass':'needs_info');
  if(!fontPresent)add('fonts-missing','warning','Шрифт не выбран','Размеры текста или сообщение о найденных файлах не заменяют выбор семейства.','Укажите название или путь к файлу, например «Шрифт: res://fonts/Inter.ttf». Если используете системный шрифт, назовите его.','fonts');
  if(/применение не подтверждено/iu.test(fields.fonts))add('fonts-unconfirmed','note','Найденный шрифт может не использоваться','В черновике есть файл шрифта без подтверждённой ссылки.','Проверьте тему и сцены Godot; назначьте шрифт явно перед утверждением.','fonts');
  const sizes=/\d+(?:[.,]\d+)?\s*(?:px|пкс|пиксел)/iu.test(fields.fonts);
  const hierarchy=/(заголов|heading|title)/iu.test(fields.fonts) && /(основн[\p{L}]*\s+текст|текст|body)/iu.test(fields.fonts) || /(весь интерфейс|всего текста|единый размер|all (?:ui|text))/iu.test(fields.fonts);
  check('typography','Заданы размеры и роли текста',sizes && hierarchy?'pass':'needs_info');
  if(!sizes || !hierarchy)add('typography-missing','warning','Не заданы правила типографики',!sizes?'Не найдены размеры в px.':'Размеры есть, но роли основного текста и заголовков не определены.','Опишите заголовки, основной текст и подписи. Для единого размера укажите это явно. Маленький пиксельный шрифт сам по себе не считается ошибкой.','fonts');

  const approved=refs.filter(r=>r.status==='approved');
  const evidence=options.referenceEvidence;
  const unavailable=evidence?approved.filter(r=>evidence[r.id]?.status==='missing' || evidence[r.id]?.status==='unreadable'):[];
  const unverified=approved.filter(r=>!evidence || !evidence[r.id] || evidence[r.id].status==='unchecked');
  check('references','Есть доступные утверждённые эталоны',approved.length && !unavailable.length && !unverified.length?'pass':unavailable.length?'issue':'needs_info');
  if(!approved.length)add('references-missing','warning','Нет утверждённого визуального эталона',refs.length?'Изображения добавлены, но все остаются кандидатами.':'Изображения-образцы не добавлены.','Выберите экран или набор компонентов, который действительно подходит игре. Утвердите образец после просмотра.','references');
  if(unverified.length)add('references-unchecked','note','Доступность файлов эталонов ещё не проверена','Утверждённых образцов без файловой проверки: '+unverified.length+'.','Откройте проект в приложении и нажмите «Проверить брендбук».','references');
  if(unavailable.length)add('references-unavailable','error','Файлы утверждённых эталонов недоступны',unavailable.map(r=>r.name).slice(0,8).join(', '),'Добавьте доступные копии изображений заново и просмотрите их перед утверждением.','references');

  const restrictions=!!fields.avoid.trim() && !/^Предлагаемые правила:/iu.test(fields.avoid.trim());
  check('constraints','Записаны принятые ограничения стиля',restrictions?'pass':'needs_info');
  if(!restrictions)add('constraints-missing','warning','Ограничения стиля не закреплены','Поле пустое или содержит автоматически предложенные общие правила.','Запишите конкретные ограничения: допустимые формы, эффекты, число акцентов, правила иконок. Уберите неподходящие предложения.','avoid');
  check('approval','Брендбук утверждён пользователем',brand.status==='approved'?'pass':'needs_info');
  if(brand.status!=='approved')add('approval-pending','note','Брендбук остаётся черновиком','Агент должен считать новые визуальные решения предложениями.','Просмотрите правила и эталоны; меняйте статус на «утверждён» после решения, а не ради числа готовых пунктов.','status');
  if(truncated || Object.keys(fields).some(k=>String(brand[k]||'').length>65536))add('review-limited','warning','Проверка ограничена объёмом данных','Просмотрено до 64 КБ каждого поля, 256 цветовых записей и 20 текстовых пар.','Сократите брендбук до основных правил и повторите проверку.','palette');
  if(brand.analysis?.stats?.limited || brand.analysis?.stats?.omitted || brand.analysis?.stats?.unreadable)add('scan-incomplete','note','Исходный автоанализ был неполным','В отчёте сканирования отмечены ограничения или пропущенные файлы.','Просмотрите источники и дополните правила вручную; наличие пропусков не доказывает плохой стиль.','direction');
  const priority={error:0,warning:1,note:2};findings.sort((a,b)=>priority[a.severity]-priority[b.severity]);
  return {version:1,checks,findings,pairs:evaluated,palette:palette.map(({hex,named})=>({hex,named})),ready:checks.filter(c=>c.status==='pass').length,total:checks.length,scope:'Проверка полноты и согласованности записанных правил. Художественное качество, изображения и запущенная игра не оценивались.',contrastBasis:'Расчёт по относительной яркости sRGB: ориентир WCAG 4.5:1 для обычного текста, 3:1 для явно помеченного крупного. Фактические размеры и отображение требуют проверки в игре; это не проверка соответствия игры стандарту доступности.'};
}
const OporaBrandReview={assessBrandbook,parseBrandHex,brandContrast,formatBrandRatio,reviewSignature};
if(typeof module!=='undefined' && module.exports)module.exports=OporaBrandReview;
