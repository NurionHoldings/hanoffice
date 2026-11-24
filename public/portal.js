import { initialOrders, advance, summarize, labels } from './portal-model.mjs';
let orders=initialOrders(), mode='admin';
const view=document.querySelector('#view');
const money=n=>n.toLocaleString('ko-KR')+'원';
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function metric(title,value){const node=el('div',undefined,'metric');node.append(el('span',title),el('strong',value));return node;}
function render(){view.replaceChildren();document.querySelector('#admin').setAttribute('aria-pressed',String(mode==='admin'));document.querySelector('#customer').setAttribute('aria-pressed',String(mode==='customer'));
if(mode==='admin'){view.append(el('h1','운영 현황'));const s=summarize(orders),m=el('div',undefined,'metrics');m.append(metric('모의 신청',s.count+'건'),metric('모의 활성 계약',s.active+'건'),metric('모의 결제 합계',money(s.paid)));view.append(m);
const card=el('article');card.append(el('h2','계약 업무 처리'),el('p','종로 1호점 · 가상 주문만 처리 가능','muted'));const wrap=el('div',undefined,'tablewrap'),table=el('table'),head=el('tr');for(const h of ['주문','고객','금액','상태','모의 처리'])head.append(el('th',h));table.append(head);
for(const o of orders){const row=el('tr');for(const value of [o.id,o.customer,money(o.amount),labels[o.state]])row.append(el('td',value));const cell=el('td'),button=el('button','다음 단계','action');button.disabled=['ACTIVE','REFUNDED'].includes(o.state);button.addEventListener('click',()=>{orders=advance(orders,o.id);render()});cell.append(button);row.append(cell);table.append(row)}wrap.append(table);card.append(wrap);view.append(card);
const branch=el('article');branch.append(el('h2','사업장 관리'),el('p','종로 1호점 · 서울 종로구 새문안로 15-1'),el('p','판매 잠금 · 소유권 및 층·호실 검증 대기','muted'));view.append(branch);
}else{view.append(el('h1','나의 비즈니스 주소'));const o=orders.find(x=>x.id==='DEMO-001'),card=el('article');card.append(el('h2','가상 고객 A의 계약'),el('p','서울 종로구 새문안로 15-1'),el('p','계약 상태: '+labels[o.state]),el('p','예시 계약금액: '+money(o.amount)),el('p','실제 계약서 발급·주소 사용·우편물 조회는 제공되지 않습니다.','muted'));view.append(card);const mail=el('article');mail.append(el('h2','우편물 서비스'),el('p','연결된 실제 우편물 없음 · 기능 개발 예정'));view.append(mail)}}
for(const id of ['admin','customer'])document.querySelector('#'+id).addEventListener('click',()=>{mode=id;render()});render();