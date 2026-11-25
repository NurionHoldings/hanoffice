const message = document.querySelector("#message");
const session = document.querySelector("#session");
const logout = document.querySelector("#logout");

async function send(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data;
}

async function refresh() {
  const response = await fetch("/api/auth/session");
  if (response.status === 503) {
    session.textContent = "계정 저장 시스템이 연결되지 않았습니다. 테스트 계정을 만들 수 없습니다.";
    logout.hidden = true;
    return;
  }
  if (!response.ok) {
    session.textContent = "로그인되어 있지 않습니다.";
    logout.hidden = true;
    return;
  }
  const data = await response.json();
  const role = data.account.role === "operator" ? "운영" : "고객";
  session.textContent = `${data.account.email} 님, ${role} 테스트 계정으로 로그인되어 있습니다.`;
  logout.hidden = false;
}

document.querySelector("#register").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await send("/api/auth/register", data);
    message.textContent = "테스트 계정을 만들었습니다. 로그인해 주세요.";
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector("#login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await send("/api/auth/login", data);
    message.textContent = "로그인했습니다.";
    await refresh();
  } catch (error) {
    message.textContent = error.message;
  }
});

logout.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  message.textContent = "로그아웃했습니다.";
  await refresh();
});

refresh();
