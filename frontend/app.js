const API = "/api";
const content = document.querySelector("#content");
const title = document.querySelector("#page-title");
const names = {dashboard:"Обзор",employees:"Сотрудники",vacancies:"Вакансии",leaves:"Отпуска"};
let currentPage = "dashboard";

async function request(path, options={}) {
  const response = await fetch(API + path, {headers:{"Content-Type":"application/json"}, ...options});
  if (!response.ok) {
    let message = "Не удалось выполнить запрос";
    try { const data = await response.json(); message = data.detail || message; } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}
function toast(message) {
  const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}
function esc(value="") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function date(value) { return value ? new Date(value+"T00:00:00").toLocaleDateString("ru-RU") : "—"; }
function shell(heading, subtitle, body) {
  content.innerHTML = `<div class="welcome"><h2>${heading}</h2><div class="muted">${subtitle}</div></div>${body}`;
}
async function dashboard() {
  const d = await request("/dashboard");
  const recent = await request("/vacancies");
  shell("Добро пожаловать!","Краткая информация о персонале и текущих задачах.",`
    <div class="stats">
      <div class="stat"><div class="stat-label">Сотрудники</div><div class="stat-value">${d.employees}</div></div>
      <div class="stat"><div class="stat-label">Открытые вакансии</div><div class="stat-value">${d.vacancies}</div></div>
      <div class="stat"><div class="stat-label">Заявки на отпуск</div><div class="stat-value">${d.leave_requests}</div></div>
    </div>
    <div class="panel"><div class="panel-head"><h3>Последние вакансии</h3><button class="btn secondary small" onclick="navigate('vacancies')">Все вакансии</button></div>
    ${recent.length ? table(["Должность","Отдел","Статус"],recent.slice(0,5).map(v=>[esc(v.title),esc(v.department),status(v.status)])) : '<div class="empty">Пока нет вакансий</div>'}</div>`);
}
function status(s){let cls=s==="Открыта"?"":s==="Закрыта"?"closed":"pending";return `<span class="status ${cls}">${esc(s)}</span>`;}
function table(headers, rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;}
function formPanel(titleText, fields, submitLabel, onSubmit) {
  return `<div class="panel"><div class="panel-head"><h3>${titleText}</h3></div><form id="create-form"><div class="form-grid">${fields}</div><div class="form-actions"><button class="btn" type="submit">${submitLabel}</button><button class="btn secondary" type="reset">Очистить</button></div></form></div>`;
}
const field=(label,name,placeholder="",type="text",required=true)=>`<label class="field">${label}<input name="${name}" type="${type}" placeholder="${placeholder}" ${required?"required":""}></label>`;
async function employees() {
  const data=await request("/employees");
  shell("Команда","Список сотрудников организации.",`
    <div class="panel"><div class="panel-head"><h3>Сотрудники</h3><span class="muted">${data.length} записей</span></div>
    ${data.length?table(["ФИО","Должность","Отдел","Email","Дата приёма"],data.map(x=>[esc(x.full_name),esc(x.position),esc(x.department),esc(x.email),date(x.hired_at)])):'<div class="empty">Добавьте первого сотрудника</div>'}</div>
    ${formPanel("Новый сотрудник",field("ФИО","full_name","Иванов Иван Иванович")+field("Должность","position","Менеджер")+field("Отдел","department","Отдел продаж", "text",false)+field("Email","email","name@example.com","email")+field("Дата приёма","hired_at","","date",false),"Добавить сотрудника",null)}`);
  document.querySelector("#create-form").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await request("/employees",{method:"POST",body:JSON.stringify(f)});toast("Сотрудник добавлен");employees();}catch(err){toast(err.message);}};
}
async function vacancies() {
  const data=await request("/vacancies");
  shell("Вакансии","Управляйте открытыми позициями и подбором сотрудников.",`
    <div class="panel"><div class="panel-head"><h3>Список вакансий</h3><span class="muted">${data.length} записей</span></div>
    ${data.length?table(["Должность","Отдел","Описание","Статус","Действие"],data.map(x=>[esc(x.title),esc(x.department),esc(x.description||"—"),status(x.status),`<button class="btn secondary small" onclick="toggleVacancy(${x.id},'${x.status==="Открыта"?"Закрыта":"Открыта"}')">${x.status==="Открыта"?"Закрыть":"Открыть"}</button>`])):'<div class="empty">Пока нет вакансий</div>'}</div>
    ${formPanel("Создать вакансию",field("Название должности","title","Специалист по подбору")+field("Отдел","department","HR")+`<label class="field">Описание<textarea name="description" placeholder="Краткое описание обязанностей"></textarea></label>`,"Добавить вакансию")}`);
  document.querySelector("#create-form").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await request("/vacancies",{method:"POST",body:JSON.stringify(f)});toast("Вакансия создана");vacancies();}catch(err){toast(err.message);}};
}
window.toggleVacancy=async(id,status)=>{try{await request(`/vacancies/${id}?status=${encodeURIComponent(status)}`,{method:"PATCH"});toast("Статус обновлён");vacancies();}catch(e){toast(e.message);}};
async function leaves() {
  const data=await request("/leaves");
  shell("Отпуска","Заявки сотрудников на плановый отпуск.",`
    <div class="panel"><div class="panel-head"><h3>Заявки</h3><span class="muted">${data.length} записей</span></div>
    ${data.length?table(["Сотрудник","Начало","Окончание","Причина","Статус","Действие"],data.map(x=>[esc(x.employee_name),date(x.start_date),date(x.end_date),esc(x.reason||"—"),status(x.status),x.status==="На рассмотрении"?`<button class="btn small" onclick="decideLeave(${x.id},'Одобрена')">Одобрить</button> <button class="btn secondary small" onclick="decideLeave(${x.id},'Отклонена')">Отклонить</button>`:"—"])):'<div class="empty">Заявок пока нет</div>'}</div>
    ${formPanel("Новая заявка",field("ФИО сотрудника","employee_name","Иванов Иван")+field("Дата начала","start_date","","date")+field("Дата окончания","end_date","","date")+field("Причина","reason","Ежегодный отпуск","text",false),"Отправить заявку")}`);
  document.querySelector("#create-form").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await request("/leaves",{method:"POST",body:JSON.stringify(f)});toast("Заявка отправлена");leaves();}catch(err){toast(err.message);}};
}
window.decideLeave=async(id,status)=>{try{await request(`/leaves/${id}?status=${encodeURIComponent(status)}`,{method:"PATCH"});toast("Решение сохранено");leaves();}catch(e){toast(e.message);}};
async function navigate(page){currentPage=page;title.textContent=names[page];document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));try{await ({dashboard,employees,vacancies,leaves}[page])();}catch(e){shell("Не удалось загрузить данные",esc(e.message),'<div class="panel empty">Проверьте подключение и обновите страницу.</div>');}}
document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
document.querySelectorAll(".nav-link").forEach(b=>b.dataset.short=({dashboard:"Обзор",employees:"Люди",vacancies:"Вакансии",leaves:"Отпуска"}[b.dataset.page]));
navigate("dashboard");
