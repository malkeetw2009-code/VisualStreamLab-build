(() => {
  "use strict";

  function showDialog(mode, message, value, options = {}) {
    return new Promise(resolve => {
      const layer = document.createElement("div");
      layer.className = "ui-dialog-layer";
      const card = document.createElement("section");
      card.className = "ui-dialog-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      const icon = document.createElement("span");
      icon.className = "ui-dialog-icon";
      icon.textContent = mode === "confirm" ? "!" : mode === "prompt" ? "✎" : "✓";
      const title = document.createElement("h2");
      title.className = "ui-dialog-title";
      title.id = "ui-dialog-title";
      title.textContent = options.title || (mode === "confirm" ? "Please confirm" : mode === "prompt" ? "Update details" : "Notice");
      card.setAttribute("aria-labelledby", title.id);
      const body = document.createElement("p");
      body.className = "ui-dialog-message";
      body.id = "ui-dialog-message";
      body.textContent = String(message ?? "");
      card.setAttribute("aria-describedby", body.id);
      const form = document.createElement("form");
      form.className = "ui-dialog-form";
      const input = document.createElement("input");
      if (mode === "prompt") {
        input.type = options.inputType || "text";
        input.value = String(value ?? "");
        if (input.type === "number") input.step = options.step || "any";
        input.className = "ui-dialog-input";
        input.setAttribute("aria-label", options.inputLabel || "Value");
        form.append(input);
      }
      const actions = document.createElement("div");
      actions.className = "ui-dialog-actions";
      const cancel = document.createElement("button");
      cancel.className = "ui-dialog-cancel";
      cancel.type = "button";
      cancel.textContent = options.cancelText || "Cancel";
      const accept = document.createElement("button");
      accept.className = "ui-dialog-accept";
      accept.type = mode === "prompt" ? "submit" : "button";
      accept.textContent = options.confirmText || (mode === "alert" ? "Got it" : "Confirm");
      if (mode !== "alert") actions.append(cancel);
      actions.append(accept);
      form.append(actions);
      card.append(icon, title, body, form);
      layer.append(card);
      document.body.append(layer);

      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKeyDown);
        layer.remove();
        resolve(result);
      };
      const onKeyDown = event => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(mode === "prompt" ? null : false);
        }
      };
      document.addEventListener("keydown", onKeyDown);
      cancel.addEventListener("click", () => finish(mode === "prompt" ? null : false));
      accept.addEventListener("click", event => {
        if (mode === "prompt") return;
        event.preventDefault();
        finish(mode === "confirm" ? true : undefined);
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        finish(input.value);
      });
      if (mode === "prompt") input.focus();
      else accept.focus();
    });
  }

  window.uiDialog = {
    alert: (message, options) => showDialog("alert", message, "", options),
    confirm: (message, options) => showDialog("confirm", message, "", options),
    prompt: (message, value, options) => showDialog("prompt", message, value, options),
  };
})();
