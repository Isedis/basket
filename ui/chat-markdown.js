/* Local Markdown rendering. Raw HTML is text, external images never load. */
window.OporaChatMarkdown=(()=>{
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases={gd:'gdscript',godot:'gdscript',js:'javascript',ts:'javascript',cs:'csharp',sh:'bash',shell:'bash',py:'python'};
  const parser=new marked.Marked({gfm:true,breaks:true,renderer:{
    html:({text})=>escape(text),
    image:({text})=>'<span class="chat-image-reference">[Изображение: '+escape(text)+']</span>',
    checkbox:({checked})=>checked?'☑ ':'☐ ',
    code:({text,lang})=>{let name=String(lang||'text').split(/\s/)[0].toLowerCase();name=aliases[name]||name;const grammar=Prism.languages[name];const body=grammar&&text.length<=20000?Prism.highlight(text,grammar,name):escape(text);return '<pre><code class="language-'+escape(name.replace(/[^a-z0-9_-]/g,''))+'">'+body+'</code></pre>';}
  }});
  function render(node,text,{copy,onLink}={}){
    node.innerHTML=DOMPurify.sanitize(parser.parse(String(text||'')),{ALLOWED_TAGS:['p','br','strong','em','del','h1','h2','h3','h4','h5','h6','ul','ol','li','pre','code','span','blockquote','hr','table','thead','tbody','tr','th','td','a'],ALLOWED_ATTR:['class','href','title','start'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
    for(const pre of node.querySelectorAll('pre')){const code=pre.querySelector('code');if(!code)continue;const bar=document.createElement('div');bar.className='chat-code-bar';const label=document.createElement('span');label.textContent=[...code.classList].find(c=>c.startsWith('language-'))?.slice(9)||'code';const button=document.createElement('button');button.className='text-button';button.type='button';button.textContent='Копировать код';button.onclick=()=>copy?.(code.textContent);bar.append(label,button);pre.prepend(bar);}
    for(const link of node.querySelectorAll('a')){const href=link.getAttribute('href')||'';if(!/^https?:\/\//i.test(href)){link.removeAttribute('href');continue;}link.title='Скопировать ссылку: '+href;link.onclick=event=>{event.preventDefault();onLink?.(href);};}
  }
  return {render};
})();
