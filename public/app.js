const form=document.querySelector("#quote-form"), status=document.querySelector("#quote-status");
const won=n=>new Intl.NumberFormat("ko-KR").format(n)+"원";
let revision=0;
async function renderQuote(event){
 const token=++revision;
 event?.preventDefault();
 status.textContent="서버에서 예시 견적을 계산하고 있습니다.";
 const data={type:form.elements.type.value,months:Number(form.elements.months.value),mail:form.elements.mail.checked,meeting:form.elements.meeting.checked};
 try{
  const res=await fetch("/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  const quote=await res.json();if(token!==revision)return;if(!res.ok)throw new Error(quote.message||"요청 실패");
  document.querySelector("#total").textContent=won(quote.total);
  document.querySelector("#monthly").textContent=won(quote.monthly);
  document.querySelector("#subtotal").textContent=won(quote.subtotal);
  document.querySelector("#vat").textContent=won(quote.vat);
  status.textContent="서버 계산 완료 · 이 견적은 판매가격이 아닌 예시입니다.";
 }catch(e){if(token!==revision)return;status.textContent="견적 계산 실패: "+e.message;}
}
form.addEventListener("submit",renderQuote);form.addEventListener("change",renderQuote);
document.querySelector("#copy-address").addEventListener("click",async()=>{
 const addr="서울특별시 종로구 새문안로 15-1",output=document.querySelector("#copy-status");
 try{await navigator.clipboard.writeText(addr);output.textContent="도로명주소를 복사했습니다.";}catch{output.textContent="복사를 지원하지 않는 환경입니다. 표시된 주소를 직접 복사해주세요.";}
});
renderQuote();