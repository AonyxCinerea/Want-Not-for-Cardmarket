// Parsing Cardmarket pages. All functions take a Document (DOMParser or jsdom).
(function (root) {
  const EDIT_LINK = /\/Wants\/\d+\/[0-9a-f]{24}\/?$/i;

  // Wants list page -> [{ idWant, name, editUrl, isAny }]
  function parseWantsList(doc) {
    const out = [];
    for (const cb of doc.querySelectorAll("input[data-id-want]")) {
      const row = cb.closest("tr");
      if (!row) continue;
      const link = [...row.querySelectorAll("a[href]")].find((a) => EDIT_LINK.test(a.getAttribute("href")));
      if (!link) continue;
      const expCell = row.querySelector("td.expansion");
      out.push({
        idWant: cb.getAttribute("data-id-want"),
        name: row.querySelector("td.name a")?.textContent.trim() || "?",
        editUrl: link.getAttribute("href"),
        isAny: !expCell || expCell.querySelectorAll(".expansion-symbol, [title], [data-bs-original-title]").length === 0,
      });
    }
    return out;
  }

  function findEditForm(doc) {
    return doc.querySelector('form[action*="WantsList_EditWant"]');
  }

  // Edit page -> { action, fields: [[name, value]], options: [{ id, name, selected }] }
  function parseEditPage(doc) {
    const form = findEditForm(doc);
    if (!form) throw new Error("Edit form not found (logged out or page changed?)");
    const select = form.querySelector('select[name="idProduct[]"]');
    if (!select) throw new Error("Expansion selector not found");
    const options = [...select.querySelectorAll("option")].map((o) => ({
      id: o.getAttribute("value"),
      name: o.textContent.replace(/\s+/g, " ").trim(),
      selected: o.hasAttribute("selected"),
    }));
    return { action: form.getAttribute("action"), fields: serializeForm(form), options };
  }

  // Mimics browser form submission from server-rendered markup.
  function serializeForm(form) {
    const fields = [];
    for (const el of form.querySelectorAll("input, select, textarea")) {
      const name = el.getAttribute("name");
      if (!name || el.hasAttribute("disabled")) continue;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (tag === "input") {
        if (["submit", "button", "image", "reset", "file"].includes(type)) continue;
        if (type === "checkbox" || type === "radio") {
          if (el.hasAttribute("checked")) fields.push([name, el.getAttribute("value") ?? "on"]);
          continue;
        }
        fields.push([name, el.getAttribute("value") ?? ""]);
      } else if (tag === "textarea") {
        fields.push([name, el.textContent]);
      } else if (tag === "select") {
        const opts = [...el.querySelectorAll("option")];
        const val = (o) => o.getAttribute("value") ?? o.textContent.trim();
        const sel = opts.filter((o) => o.hasAttribute("selected"));
        if (el.hasAttribute("multiple")) {
          for (const o of sel) if (!o.hasAttribute("disabled")) fields.push([name, val(o)]);
        } else {
          // single select: last "selected" wins, default is the first option
          const o = sel.length ? sel[sel.length - 1] : opts[0];
          if (o && !o.hasAttribute("disabled")) fields.push([name, val(o)]);
        }
      }
    }
    return fields;
  }

  // Replace idProduct[] values, keeping all other fields untouched.
  function buildEditBody(fields, productIds) {
    const params = new URLSearchParams();
    let inserted = false;
    const insert = () => {
      if (inserted) return;
      for (const id of productIds) params.append("idProduct[]", id);
      inserted = true;
    };
    for (const [k, v] of fields) {
      if (k === "idProduct[]") { insert(); continue; }
      if (k === "idProductTempInput") insert();
      params.append(k, v);
    }
    insert();
    return params;
  }

  const api = { parseWantsList, parseEditPage, serializeForm, buildEditBody };
  if (typeof module !== "undefined") module.exports = api;
  else root.WantNotParse = api;
})(this);
