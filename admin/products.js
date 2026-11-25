/* Products: add, edit, hide, reorder and remove shop items. Changes go live when you press Save. */
(function () {
  var A = window.Admin, h = A.h;
  var LIB = null;
  function library() {
    if (LIB) return Promise.resolve(LIB);
    return fetch("data/images.json").then(function (r) { return r.json(); }).catch(function () { return []; }).then(function (l) { LIB = l; return l; });
  }

  /** Shrinks a chosen photo in the browser to at most 1000px wide, as JPEG, so uploads stay small. */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = Math.min(1000, img.width), k = w / img.width, c = document.createElement("canvas");
        c.width = w; c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = function () { reject(new Error("That file could not be read as a photo.")); };
      img.src = url;
    });
  }

  function editor(p, done) {
    var d = Object.assign({ name: "", description: "", price: "", image: "", stripeLink: "", inStock: true, visible: true }, p);
    var name = h("input", { type: "text", value: d.name, maxlength: 80 });
    var desc = h("textarea", { rows: 3, maxlength: 300, text: d.description });
    var price = h("input", { type: "text", value: d.price, maxlength: 20, placeholder: "$29.00" });
    var link = h("input", { type: "url", value: d.stripeLink, placeholder: "https://buy.stripe.com/…" });
    var image = h("input", { type: "text", value: d.image, placeholder: "images/… or https://…" });
    var stock = h("input", { type: "checkbox", checked: d.inStock }), vis = h("input", { type: "checkbox", checked: d.visible });
    var preview = h("img", { class: "thumb big", alt: "" });
    function showPreview() { var s = A.imgSrc(image.value.trim()); preview.style.visibility = s ? "visible" : "hidden"; if (s) preview.src = s; }
    image.addEventListener("input", showPreview); showPreview();
    var libBox = h("div", { class: "lib" });
    library().then(function (l) {
      l.forEach(function (it) {
        libBox.appendChild(h("button", { type: "button", class: "lib-item", title: it.label, onclick: function () { image.value = it.path; showPreview(); } },
          h("img", { src: it.path, alt: it.label, loading: "lazy" })));
      });
    });
    var file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", onchange: function () {
      var f = file.files[0]; if (!f) return;
      A.toast("Uploading photo…");
      shrink(f).then(function (b64) { return A.call("adminUpload", { name: f.name, mime: "image/jpeg", data: b64 }); }).then(function (r) {
        if (r.ok) { image.value = r.url; showPreview(); A.toast("Photo uploaded"); } else A.toast(r.error, "bad");
      }, function (e) { A.toast(e.message, "bad"); });
      file.value = "";
    } });
    var err = h("p", { class: "error", role: "alert" });
    var ok = h("button", { class: "btn primary", type: "button", text: "Done", onclick: function () {
      if (!name.value.trim()) { err.textContent = "Please give the product a name."; return; }
      if (!price.value.trim()) { err.textContent = "Please add a price, like $29.00."; return; }
      done(Object.assign({}, d, { name: name.value, description: desc.value, price: price.value, image: image.value.trim(), stripeLink: link.value.trim(), inStock: stock.checked, visible: vis.checked }));
    } });
    return h("div", { class: "form-grid" },
      A.field("Name", name), A.field("Price", price), A.field("Description", desc),
      A.field("Stripe payment link", link, "Create it in Stripe: Payment Links, then paste the link here. Leave blank to show \"Coming soon\"."),
      h("div", { class: "field" }, h("span", { class: "lab", text: "Photo" }), h("div", { class: "photo-row" }, preview, h("div", {}, image,
        h("small", { text: "Pick one of your photos, upload a new one, or paste an address." }), libBox,
        h("label", { class: "btn small upload", text: "Upload a photo" }, file)))),
      h("div", { class: "checks" }, h("label", { class: "check" }, stock, h("span", { text: "In stock (untick to show Sold out)" })), h("label", { class: "check" }, vis, h("span", { text: "Show in the shop (untick to hide)" }))),
      err, h("div", { class: "actions" }, ok, h("button", { class: "btn", type: "button", text: "Cancel", onclick: function () { done(null); } })));
  }

  A.register({ id: "products", label: "Products", icon: "🧺", render: function (root) {
    var items = [], dirty = false, managed = true;
    var list = h("div", {}), holder = h("div", {}), note = h("p", { class: "note" });
    var save = h("button", { class: "btn primary", type: "button", text: "Save draft", disabled: true });
    function mark(v) { dirty = v; save.disabled = !v; save.textContent = v ? "Save draft" : "Draft saved"; }
    function move(i, dir) { var j = i + dir; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; mark(true); draw(); }
    function edit(i) {
      A.clear(holder);
      var isNew = i < 0;
      holder.appendChild(h("section", { class: "card-box editor" }, h("h3", { text: isNew ? "New product" : "Edit product" }),
        editor(isNew ? {} : items[i], function (p) {
          A.clear(holder);
          if (!p) return;
          if (isNew) items.push(p); else items[i] = p;
          mark(true); draw();
        })));
      holder.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function draw() {
      A.clear(list);
      if (!items.length) list.appendChild(h("div", { class: "empty-state" }, h("p", { text: "No products yet. Add your first play kit." })));
      items.forEach(function (p, i) {
        var src = A.imgSrc(p.image);
        list.appendChild(h("div", { class: "row-card" + (p.visible === false ? " past" : "") },
          src ? h("img", { class: "thumb", src: src, alt: "" }) : h("div", { class: "thumb none", text: "No photo" }),
          h("div", { class: "grow" }, h("strong", { text: p.name }), h("small", { text: p.price + (p.stripeLink ? "" : " · no payment link yet") }),
            h("div", {}, p.visible === false ? h("span", { class: "tag", text: "Hidden" }) : null, p.inStock === false ? h("span", { class: "tag warn", text: "Sold out" }) : null)),
          h("div", { class: "row-actions" },
            h("button", { class: "btn small icon", type: "button", "aria-label": "Move up", title: "Move up", disabled: i === 0, text: "↑", onclick: function () { move(i, -1); } }),
            h("button", { class: "btn small icon", type: "button", "aria-label": "Move down", title: "Move down", disabled: i === items.length - 1, text: "↓", onclick: function () { move(i, 1); } }),
            h("button", { class: "btn small", type: "button", text: p.visible === false ? "Show" : "Hide", onclick: function () { p.visible = p.visible === false; mark(true); draw(); } }),
            h("button", { class: "btn small", type: "button", text: "Edit", onclick: function () { edit(i); } }),
            h("button", { class: "btn small danger-o", type: "button", text: "Remove", onclick: function () {
              A.confirm("Remove “" + p.name + "”?", "It leaves the draft shop when you press Save draft, and the live shop when you publish.", "Remove", true).then(function (y) { if (y) { items.splice(i, 1); mark(true); draw(); } });
            } }))));
      });
    }
    save.addEventListener("click", function () {
      A.busy(save, A.call("adminSaveProducts", { products: items })).then(function (r) {
        if (!r.ok) { A.toast(r.error, "bad"); return; }
        items = r.products; managed = true; note.textContent = ""; mark(false); draw();
        A.toast("Draft saved. Preview it, then publish when ready."); A.refreshDraftBar(r.status);
      });
    });
    window.onbeforeunload = function () { return dirty ? "You have unsaved product changes." : undefined; };
    root.appendChild(h("div", { class: "page-head" }, h("h2", { text: "Products" }), h("div", {}, h("button", { class: "btn", type: "button", text: "+ Add product", onclick: function () { edit(-1); } }), save)));
    root.appendChild(note); root.appendChild(holder); root.appendChild(list);
    A.call("adminProducts").then(function (r) {
      if (!r.ok) { list.appendChild(h("p", { class: "error", text: r.error })); return; }
      managed = r.managed;
      if (r.managed) items = r.products;
      else {
        // Not saved from here yet: start from the products the website is showing now.
        fetch("data/products.json").then(function (x) { return x.json(); }).then(function (l) {
          items = l.map(function (p) { return Object.assign({ visible: true }, p); });
          note.textContent = "These are your current products. Press Save draft, then publish, to start managing them from here.";
          mark(true); draw();
        }).catch(function () { mark(false); draw(); });
      }
      mark(false); draw();
    });
  } });
})();
