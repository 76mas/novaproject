export function saveTemplate(name, pages) {
  const templates = JSON.parse(localStorage.getItem("templates") || "[]");

  templates.push({ id: crypto.randomUUID(), name, pages });

  localStorage.setItem("templates", JSON.stringify(templates));
}

export function getTemplates() {
  return JSON.parse(localStorage.getItem("templates") || "[]");
}
