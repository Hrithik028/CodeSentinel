export function showWelcomeMessage(name) {
  document.querySelector('#welcome').innerHTML = name;
}

export async function loadProfile() {
  const response = await fetch('http://api.example.com/profile');
  return response.json();
}
